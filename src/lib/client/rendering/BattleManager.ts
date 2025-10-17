import { BattleAnimationSystem } from './BattleAnimationSystem';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { GameStateData, Region } from '$lib/game/entities/gameTypes';

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

  async executeMove(move: BattleMove, playerId: string, regions: Region[]): Promise<BattleResult> {
    if (this.isBattleRequired(move)) {
      return this.executeBattle(move, playerId, regions);
    } else {
      return this.executePeacefulMove(move, playerId);
    }
  }

  async executeBattle(move: BattleMove, playerId: string, regions: Region[]): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🏛️ BattleManager: Starting battle execution', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      // Trigger movement animation before battle
      this.dispatchMovementAnimation(sourceRegionIndex, targetRegionIndex, soldierCount);
      
      // Initialize battle animation BEFORE sending to server to prevent race condition
      // This sets up overrides so WebSocket updates don't immediately change ownership
      const startingSourceCount = move.gameState.soldiersByRegion?.[sourceRegionIndex]?.length || 0;
      const startingTargetCount = move.gameState.soldiersByRegion?.[targetRegionIndex]?.length || 0;
      const targetOwner = move.gameState.ownersByRegion?.[targetRegionIndex]; // Original owner before conquest
      
      if (typeof window !== 'undefined') {
        console.log(`🎬 Initializing battle animation BEFORE server call - Source: ${startingSourceCount}, Target: ${startingTargetCount}, Owner: ${targetOwner}`);
        
        window.dispatchEvent(new CustomEvent('battleAnimationStart', {
          detail: {
            sourceRegion: sourceRegionIndex,
            targetRegion: targetRegionIndex,
            sourceCount: startingSourceCount,
            targetCount: startingTargetCount,
            targetOwner: targetOwner // Preserve original owner during animation
          }
        }));
      }
      
      this.startBattleTimeout(targetRegionIndex);
      const battleState = this.createBattleState(move.gameState, targetRegionIndex, move);
      const result = await this.sendBattleToServer(move, playerId);

      if (result.attackSequence && result.attackSequence.length > 0) {
        
        // Create a state update callback for real-time soldier count updates
        const stateUpdateCallback = (attackerLosses: number, defenderLosses: number) => {
          console.log(`🎯 Battle round: Attacker loses ${attackerLosses}, Defender loses ${defenderLosses}`);
          
          // Dispatch event to update UI with current casualties
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('battleRoundUpdate', {
              detail: {
                sourceRegion: sourceRegionIndex,
                targetRegion: targetRegionIndex,
                attackerLosses,
                defenderLosses
              }
            }));
          }
        };

        await this.playBattleAnimation(result.attackSequence, regions, stateUpdateCallback);
      }
      
      // Always dispatch battle complete event to clear animation overrides
      // (even if there was no attack sequence)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleComplete'));
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
  async executePeacefulMove(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🕊️ BattleManager: Executing peaceful move', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      // Trigger movement animation for immediate feedback
      this.dispatchMovementAnimation(sourceRegionIndex, targetRegionIndex, soldierCount);
      
      // Initialize animation overrides BEFORE sending to server to prevent race condition
      // This preserves the old ownership during the movement animation
      const startingSourceCount = move.gameState.soldiersByRegion?.[sourceRegionIndex]?.length || 0;
      const startingTargetCount = move.gameState.soldiersByRegion?.[targetRegionIndex]?.length || 0;
      const targetOwner = move.gameState.ownersByRegion?.[targetRegionIndex]; // Current owner (undefined for neutral)
      
      if (typeof window !== 'undefined') {
        console.log(`🎬 Initializing peaceful move animation BEFORE server call - Target: ${targetRegionIndex}, Count: ${startingTargetCount}, Owner: ${targetOwner}`);
        
        window.dispatchEvent(new CustomEvent('battleAnimationStart', {
          detail: {
            sourceRegion: sourceRegionIndex,
            targetRegion: targetRegionIndex,
            sourceCount: startingSourceCount,
            targetCount: startingTargetCount,
            targetOwner: targetOwner // Preserve original owner (or undefined) during animation
          }
        }));
      }
      
      audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);
      const result = await this.sendMoveToServer(move, playerId);
      
      // Wait for the movement animation to complete, then clear overrides
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('battleComplete'));
          }
          resolve();
        }, 600); // Match the movement animation duration
      });
      
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
      
      // Clear animation overrides on error
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleComplete'));
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Play battle animation sequence with optional state update callback
   */
  private async playBattleAnimation(
    attackSequence: any[], 
    regions?: Region[],
    onStateUpdate?: (attackerLosses: number, defenderLosses: number) => void
  ): Promise<void> {
    console.log('🎬 BattleManager: Playing attack sequence');

    try {
      await this.battleAnimationSystem.playAttackSequence(attackSequence, regions || [], onStateUpdate);
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

  /**
   * Dispatch movement animation event
   */
  private dispatchMovementAnimation(sourceRegion: number, targetRegion: number, soldierCount: number): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('animateMovement', {
        detail: {
          sourceRegion,
          targetRegion,
          soldierCount,
          duration: 500 // Half second animation
        }
      }));
    }
  }

  destroy(): void {
    console.log('💥 BattleManager: Destroying and cleaning up');
    this.clearAllBattleTimeouts();
  }
}
