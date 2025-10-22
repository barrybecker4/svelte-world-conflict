import { BattleAnimationSystem } from './BattleAnimationSystem';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { GameStateData, Region } from '$lib/game/entities/gameTypes';
import { GameState } from '$lib/game/state/GameState';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';

export interface BattleMove {
  sourceRegionIndex: number;
  targetRegionIndex: number;
  soldierCount: number;
  gameState: GameStateData;
}

export interface BattleResult {
  success: boolean;
  gameState?: GameStateData;
  attackSequence?: any[];
  error?: string;
}

export interface ExecuteMoveOptions {
  localMode?: boolean; // If true, execute locally without sending to server
}

/**
 * Manages all battle-related operations including animations, timeouts, and state coordination
 */
export class BattleManager {
  private battleAnimationSystem: BattleAnimationSystem;
  private battleTimeouts = new Map<number, number>();
  private gameId: string;

  constructor(gameId: string, mapContainer?: HTMLElement) {
    this.gameId = gameId;
    this.battleAnimationSystem = new BattleAnimationSystem();

    if (mapContainer) {
      this.battleAnimationSystem.setMapContainer(mapContainer);
    }
  }

  setMapContainer(container: HTMLElement): void {
    this.battleAnimationSystem.setMapContainer(container);
  }

  isBattleRequired(move: BattleMove): boolean {
    const { targetRegionIndex, gameState } = move;

    const targetSoldiers = gameState.soldiersByRegion?.[targetRegionIndex] || [];
    const targetOwner = gameState.ownersByRegion?.[targetRegionIndex];
    const currentPlayerSlot = gameState.currentPlayerSlot;

    const isNeutralWithSoldiers = targetOwner === undefined && targetSoldiers.length > 0;
    const isEnemyTerritory = targetOwner !== undefined && targetOwner !== currentPlayerSlot && targetSoldiers.length > 0;

    return isNeutralWithSoldiers || isEnemyTerritory;
  }

  async executeMove(move: BattleMove, playerId: string, regions: Region[], options?: ExecuteMoveOptions): Promise<BattleResult> {
    if (this.isBattleRequired(move)) {
      return this.executeBattle(move, playerId, regions, options);
    } else {
      return this.executePeacefulMove(move, playerId, options);
    }
  }

  async executeBattle(move: BattleMove, playerId: string, regions: Region[], options?: ExecuteMoveOptions): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🏛️ BattleManager: Starting battle execution', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount,
      localMode: options?.localMode
    });

    try {
      this.startBattleTimeout(targetRegionIndex);

      // Set attackedRegion on a COPY of soldiers at source for halfway animation
      const sourceSoldiers = move.gameState.soldiersByRegion?.[sourceRegionIndex] || [];
      
      console.log(`⚔️ Setting attackedRegion on ${soldierCount} soldiers for halfway animation`);
      
      // Create a deep copy of the game state for animation
      const animationState = JSON.parse(JSON.stringify(move.gameState));
      const animationSoldiers = animationState.soldiersByRegion?.[sourceRegionIndex] || [];
      
      // Set attackedRegion on the animation state's soldiers
      animationSoldiers.slice(0, soldierCount).forEach((soldier: any) => {
        soldier.attackedRegion = targetRegionIndex;
      });

      // Dispatch animation state update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }

      // Wait for soldiers to animate halfway
      await new Promise(resolve => setTimeout(resolve, 700));

      // NOW execute on server to validate and persist
      const result = options?.localMode
        ? await this.executeLocally(move, playerId)
        : await this.sendBattleToServer(move, playerId);

      if (!result.success) {
        throw new Error(result.error || 'Battle failed');
      }

      // Play battle animation (shows casualties, sounds, etc)
      if (result.attackSequence && result.attackSequence.length > 0) {
        await this.playBattleAnimation(result.attackSequence, regions, sourceRegionIndex, targetRegionIndex);
        
        // Wait for smoke animations to complete
        // Smoke takes 3.05s (matching old GAS version), and the last smoke starts ~600ms before animation completes
        // So we need to wait (3050ms - 600ms) = 2450ms more
        console.log('⏳ Waiting for smoke effects to complete...');
        await new Promise(resolve => setTimeout(resolve, 2500));
        console.log('✅ Smoke effects complete');
        
        // Animate surviving attackers moving into the conquered region
        // Pass the current animation state (soldiers still at source with attackedRegion)
        console.log('🏃 Animating conquering soldiers into target region...');
        await this.animateConqueringMove(animationState, result.gameState!, sourceRegionIndex, targetRegionIndex);
      }

      this.clearBattleTimeout(targetRegionIndex);

      if (result.gameState) {
        result.gameState = this.clearBattleState(result.gameState);
      }

      console.log('✅ BattleManager: Battle completed successfully');
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown battle error';
      // Don't log validation errors as console errors - they're expected game rules
      if (errorMessage.includes('conquered') || errorMessage.includes('No moves remaining')) {
        console.log('⚠️ BattleManager: Move not allowed -', errorMessage);
      } else {
        console.error('❌ BattleManager: Battle failed:', error);
      }
      this.clearBattleTimeout(targetRegionIndex);

      return {
        success: false,
        error: errorMessage,
        gameState: this.clearBattleState(move.gameState)
      };
    }
  }

  /**
   * Execute a non-battle move (peaceful territory occupation)
   */
  async executePeacefulMove(move: BattleMove, playerId: string, options?: ExecuteMoveOptions): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🕊️ BattleManager: Executing peaceful move', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount,
      localMode: options?.localMode
    });

    try {
      console.log(`🚶 Player Move: ${soldierCount} soldiers moving from ${sourceRegionIndex} to ${targetRegionIndex}`);
      
      // Wait for next frame to ensure current state is rendered
      await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
      
      // Create animation state: Mark soldiers with movingToRegion but keep them at source
      // This ensures the same DOM elements transition (no pop-in)
      const animationState = JSON.parse(JSON.stringify(move.gameState));
      const sourceSoldiers = animationState.soldiersByRegion?.[sourceRegionIndex] || [];
      
      console.log(`📍 Source region ${sourceRegionIndex} has ${sourceSoldiers.length} soldiers:`, sourceSoldiers.map(s => s.i));
      console.log(`🎯 Marking LAST ${soldierCount} soldiers as moving to ${targetRegionIndex} (server uses pop())`);
      
      // Mark soldiers as moving (they stay in source array for rendering)
      // IMPORTANT: Server uses pop() which takes from END of array, so mark the LAST N soldiers
      const startIndex = Math.max(0, sourceSoldiers.length - soldierCount);
      for (let i = startIndex; i < sourceSoldiers.length; i++) {
        console.log(`  ✅ Soldier ${sourceSoldiers[i].i} at index ${i} marked as moving to ${targetRegionIndex}`);
        sourceSoldiers[i].movingToRegion = targetRegionIndex;
      }
      
      console.log(`📍 Remaining ${startIndex} soldiers staying at source:`, 
        sourceSoldiers.slice(0, startIndex).map(s => s.i));
      
      // Apply animation state
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }
      
      // Play movement sound
      audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

      // Wait for CSS transition to complete (600ms transition + buffer)
      await new Promise(resolve => setTimeout(resolve, 700));

      // NOW execute on server to validate and persist
      const result = options?.localMode
        ? await this.executeLocally(move, playerId)
        : await this.sendMoveToServer(move, playerId);

      if (!result.success) {
        throw new Error(result.error || 'Move failed');
      }

      console.log('✅ BattleManager: Peaceful move completed successfully');
      
      // Log final state
      if (result.gameState) {
        const finalSourceSoldiers = result.gameState.soldiersByRegion?.[sourceRegionIndex] || [];
        const finalTargetSoldiers = result.gameState.soldiersByRegion?.[targetRegionIndex] || [];
        console.log(`📊 FINAL STATE - Source ${sourceRegionIndex} has ${finalSourceSoldiers.length} soldiers:`, finalSourceSoldiers.map(s => s.i));
        console.log(`📊 FINAL STATE - Target ${targetRegionIndex} has ${finalTargetSoldiers.length} soldiers:`, finalTargetSoldiers.map(s => s.i));
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown move error';
      // Don't log validation errors as console errors - they're expected game rules
      if (errorMessage.includes('conquered') || errorMessage.includes('No moves remaining')) {
        console.log('⚠️ BattleManager: Move not allowed -', errorMessage);
      } else {
        console.error('❌ BattleManager: Peaceful move failed:', error);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Execute move locally using ArmyMoveCommand (for undo support)
   * This is called when localMode is true - no server communication
   */
  private async executeLocally(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('💻 BattleManager: Executing locally (no server call)');

    try {
      // Create GameState instance from the current game state data
      const gameState = GameState.fromJSON(move.gameState);

      // Find the player
      const playerSlotIndex = parseInt(playerId);
      const player = gameState.players.find(p => p.slotIndex === playerSlotIndex);

      if (!player) {
        throw new Error(`Player with slot index ${playerSlotIndex} not found`);
      }

      // Create and execute the ArmyMoveCommand
      const command = new ArmyMoveCommand(
        gameState,
        player,
        sourceRegionIndex,
        targetRegionIndex,
        soldierCount
      );

      // Validate the command
      const validation = command.validate();
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Execute the command to get the new state
      const newGameState = command.execute();
      const attackSequence = command.attackSequence;

      return {
        success: true,
        gameState: newGameState.toJSON(),
        attackSequence: attackSequence
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown local execution error';
      console.error('❌ BattleManager: Local execution failed:', error);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Play battle animation sequence with incremental state updates
   */
  private async playBattleAnimation(
    attackSequence: any[],
    regions?: Region[],
    sourceRegion?: number,
    targetRegion?: number
  ): Promise<void> {
    console.log('🎬 BattleManager: Playing attack sequence with incremental casualties');

    try {
      // Track total casualties dispatched so far
      let totalAttackerCasualties = 0;
      let totalDefenderCasualties = 0;

      // Create callback to incrementally remove soldiers during animation
      const onStateUpdate = (attackerCasualties: number, defenderCasualties: number) => {
        totalAttackerCasualties += attackerCasualties;
        totalDefenderCasualties += defenderCasualties;
        
        // Dispatch event to remove soldiers from display
        if (typeof window !== 'undefined' && (attackerCasualties > 0 || defenderCasualties > 0)) {
          window.dispatchEvent(new CustomEvent('battleCasualties', {
            detail: {
              sourceRegion,
              targetRegion,
              attackerCasualties,
              defenderCasualties
            }
          }));
        }
      };

      await this.battleAnimationSystem.playAttackSequence(attackSequence, regions || [], onStateUpdate);
      
      console.log(`✅ Battle animation complete. Total casualties: A${totalAttackerCasualties} D${totalDefenderCasualties}`);
    } catch (error) {
      console.warn('⚠️ BattleManager: Animation failed, continuing without animation:', error);
    }
  }

  /**
   * Animate conquering soldiers moving into the conquered region
   */
  private async animateConqueringMove(
    currentAnimationState: GameStateData,
    finalGameState: GameStateData,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    // Check if conquest was successful by seeing if there are attackers at target
    // AND that the target ownership changed to the attacker's team
    const targetSoldiersInFinal = finalGameState.soldiersByRegion?.[targetRegion] || [];
    const sourceOwner = finalGameState.ownersByRegion?.[sourceRegion];
    const targetOwner = finalGameState.ownersByRegion?.[targetRegion];
    
    // Only animate if:
    // 1. There are soldiers at the target (attackers survived)
    // 2. Target is now owned by the same player as source (conquest successful)
    const conquestSuccessful = targetSoldiersInFinal.length > 0 && sourceOwner === targetOwner;
    
    if (!conquestSuccessful) {
      console.log('⚔️ Attack failed or no survivors, skipping conquest animation');
      return; // Attack failed or no survivors
    }
    
    console.log(`🏆 Conquest successful! Animating ${targetSoldiersInFinal.length} soldiers into region ${targetRegion}`);

    // Create new animation state with survivors still at source
    const newAnimationState = JSON.parse(JSON.stringify(finalGameState));
    
    // Get the soldier IDs that survived (now at target in final state)
    const survivorIds = new Set(targetSoldiersInFinal.map((s: any) => s.i));
    
    // Get soldiers currently at source with attackedRegion
    const currentSourceSoldiers = currentAnimationState.soldiersByRegion?.[sourceRegion] || [];
    
    // Find the attacking soldiers that survived (match IDs)
    const survivingAttackers = currentSourceSoldiers.filter((s: any) => 
      s.attackedRegion === targetRegion && survivorIds.has(s.i)
    );
    
    console.log(`Found ${survivingAttackers.length} surviving attackers to animate (out of ${targetSoldiersInFinal.length} total)`);
    
    // Place survivors at source with movingToRegion set
    newAnimationState.soldiersByRegion[sourceRegion] = survivingAttackers.map((s: any) => ({
      ...s,
      attackedRegion: undefined,
      movingToRegion: targetRegion
    }));
    
    // Clear target region (soldiers will animate there)
    newAnimationState.soldiersByRegion[targetRegion] = [];

    // Dispatch animation state update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('battleStateUpdate', {
        detail: { gameState: newAnimationState }
      }));
    }

    // Wait for CSS transition to complete (soldiers moving from halfway to target)
    await new Promise(resolve => setTimeout(resolve, 700));
    console.log('✅ Conquering soldiers reached target region');
  }

  /**
   * Create battle state for immediate UI feedback
   */
  private createBattleState(gameState: GameStateData, battleRegionIndex: number, move: BattleMove): GameStateData {
    return {
      ...gameState,
      battlesInProgress: [...new Set([...(gameState.battlesInProgress || []), battleRegionIndex])],
      pendingMoves: [
        ...(gameState.pendingMoves || []),
        {
          fromRegion: move.sourceRegionIndex,
          toRegion: move.targetRegionIndex,
          soldierCount: move.soldierCount
        }
      ]
    };
  }

  private clearBattleState(gameState: GameStateData): GameStateData {
    return {
      ...gameState,
      battlesInProgress: [],
      pendingMoves: []
    };
  }

  private async sendBattleToServer(move: BattleMove, playerId: string): Promise<BattleResult> {
    return this.sendMoveToServer(move, playerId);
  }

  private async sendMoveToServer(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    const response = await fetch(`/api/game/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moveType: 'ARMY_MOVE',
        playerId,
        source: sourceRegionIndex,
        destination: targetRegionIndex,
        count: soldierCount
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json() as { gameState: GameStateData; attackSequence: any[] };
    return {
      success: true,
      gameState: result.gameState,
      attackSequence: result.attackSequence
    };
  }

  /**
   * Start battle timeout to prevent stuck battles
   */
  private startBattleTimeout(regionIndex: number): void {
    console.log('⏰ BattleManager: Starting battle timeout for region', regionIndex);

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ BattleManager: Battle timeout reached for region', regionIndex);
      this.clearBattleTimeout(regionIndex);
    }, 3000);

    this.battleTimeouts.set(regionIndex, timeoutId as unknown as number);
  }

  /**
   * Clear battle timeout for a specific region
   */
  private clearBattleTimeout(regionIndex: number): void {
    const timeoutId = this.battleTimeouts.get(regionIndex);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.battleTimeouts.delete(regionIndex);
      console.log('🔄 BattleManager: Cleared battle timeout for region', regionIndex);
    }
  }

  clearAllBattleTimeouts(): void {
    console.log('🧹 BattleManager: Clearing all battle timeouts');
    this.battleTimeouts.forEach(timeout => clearTimeout(timeout));
    this.battleTimeouts.clear();
  }

  getBattleAnimationSystem(): BattleAnimationSystem {
    return this.battleAnimationSystem;
  }

  hasActiveBattles(): boolean {
    return this.battleTimeouts.size > 0;
  }

  getActiveBattleRegions(): number[] {
    return Array.from(this.battleTimeouts.keys());
  }

  destroy(): void {
    console.log('💥 BattleManager: Destroying and cleaning up');
    this.clearAllBattleTimeouts();
  }
}
