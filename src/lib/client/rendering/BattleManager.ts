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
        await this.playBattleAnimation(result.attackSequence, regions);
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
      // Create a deep copy of game state for animation
      console.log(`🚶 Setting movingToRegion on ${soldierCount} soldiers for animation`);
      
      const animationState = JSON.parse(JSON.stringify(move.gameState));
      const animationSoldiers = animationState.soldiersByRegion?.[sourceRegionIndex] || [];
      
      // Set movingToRegion on the animation state's soldiers
      animationSoldiers.slice(0, soldierCount).forEach((soldier: any) => {
        soldier.movingToRegion = targetRegionIndex;
      });

      // Dispatch animation state update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }

      // Play movement sound
      audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

      // Wait for CSS transition to complete
      await new Promise(resolve => setTimeout(resolve, 700));

      // NOW execute on server to validate and persist
      const result = options?.localMode
        ? await this.executeLocally(move, playerId)
        : await this.sendMoveToServer(move, playerId);

      if (!result.success) {
        throw new Error(result.error || 'Move failed');
      }

      console.log('✅ BattleManager: Peaceful move completed successfully');
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
   * Play battle animation sequence
   */
  private async playBattleAnimation(
    attackSequence: any[],
    regions?: Region[]
  ): Promise<void> {
    console.log('🎬 BattleManager: Playing attack sequence');

    try {
      await this.battleAnimationSystem.playAttackSequence(attackSequence, regions || []);
    } catch (error) {
      console.warn('⚠️ BattleManager: Animation failed, continuing without animation:', error);
    }
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
