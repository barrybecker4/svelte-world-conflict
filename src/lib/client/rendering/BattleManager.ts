import { BattleAnimationSystem } from './BattleAnimationSystem';
import { AnimationStateCoordinator } from './AnimationStateCoordinator';
import { BattleTimeoutManager } from './BattleTimeoutManager';
import { LocalMoveExecutor } from './LocalMoveExecutor';
import { BattleApiClient } from '$lib/client/api/BattleApiClient';
import type { GameStateData, Region } from '$lib/game/entities/gameTypes';

// Re-export types for backward compatibility
export type { BattleMove, BattleResult } from '$lib/client/api/BattleApiClient';

export interface ExecuteMoveOptions {
  localMode?: boolean; // If true, execute locally without sending to server
}

/**
 * Manages all battle-related operations including animations, timeouts, and state coordination
 */
export class BattleManager {
  private battleAnimationSystem: BattleAnimationSystem;
  private animationCoordinator: AnimationStateCoordinator;
  private timeoutManager: BattleTimeoutManager;
  private localExecutor: LocalMoveExecutor;
  private apiClient: BattleApiClient;
  private gameId: string;

  constructor(gameId: string, mapContainer?: HTMLElement) {
    this.gameId = gameId;
    this.battleAnimationSystem = new BattleAnimationSystem();
    this.animationCoordinator = new AnimationStateCoordinator();
    this.timeoutManager = new BattleTimeoutManager();
    this.localExecutor = new LocalMoveExecutor();
    this.apiClient = new BattleApiClient(gameId);

    if (mapContainer) {
      this.battleAnimationSystem.setMapContainer(mapContainer);
    }
  }

  setMapContainer(container: HTMLElement): void {
    this.battleAnimationSystem.setMapContainer(container);
  }

  isBattleRequired(move: import('$lib/client/api/BattleApiClient').BattleMove): boolean {
    const { targetRegionIndex, gameState } = move;

    const targetSoldiers = gameState.soldiersByRegion?.[targetRegionIndex] || [];
    const targetOwner = gameState.ownersByRegion?.[targetRegionIndex];
    const currentPlayerSlot = gameState.currentPlayerSlot;

    const isNeutralWithSoldiers = targetOwner === undefined && targetSoldiers.length > 0;
    const isEnemyTerritory = targetOwner !== undefined && targetOwner !== currentPlayerSlot && targetSoldiers.length > 0;

    return isNeutralWithSoldiers || isEnemyTerritory;
  }

  async executeMove(move: import('$lib/client/api/BattleApiClient').BattleMove, playerId: string, regions: Region[], options?: ExecuteMoveOptions): Promise<import('$lib/client/api/BattleApiClient').BattleResult> {
    if (this.isBattleRequired(move)) {
      return this.executeBattle(move, playerId, regions, options);
    } else {
      return this.executePeacefulMove(move, playerId, options);
    }
  }

  async executeBattle(move: import('$lib/client/api/BattleApiClient').BattleMove, playerId: string, regions: Region[], options?: ExecuteMoveOptions): Promise<import('$lib/client/api/BattleApiClient').BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('🏛️ BattleManager: Starting battle execution', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount,
      localMode: options?.localMode
    });

    try {
      this.timeoutManager.startBattleTimeout(targetRegionIndex);

      // Create and dispatch attacking animation state (soldiers at source with attackedRegion)
      const animationState = this.animationCoordinator.createAttackingAnimationState(
        move.gameState,
        sourceRegionIndex,
        targetRegionIndex,
        soldierCount
      );
      this.animationCoordinator.dispatchBattleStateUpdate(animationState);

      // Wait for soldiers to animate halfway
      await new Promise(resolve => setTimeout(resolve, 700));

      // NOW execute on server to validate and persist
      const result = options?.localMode
        ? await this.localExecutor.execute(move, playerId)
        : await this.apiClient.executeMove(move, playerId);

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
        console.log('🏃 Animating conquering soldiers into target region...');
        await this.animationCoordinator.animateConqueringMove(
          animationState,
          result.gameState!,
          sourceRegionIndex,
          targetRegionIndex
        );
      }

      this.timeoutManager.clearBattleTimeout(targetRegionIndex);

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
      this.timeoutManager.clearBattleTimeout(targetRegionIndex);

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
  async executePeacefulMove(move: import('$lib/client/api/BattleApiClient').BattleMove, playerId: string, options?: ExecuteMoveOptions): Promise<import('$lib/client/api/BattleApiClient').BattleResult> {
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
      
      // Create and dispatch peaceful move animation state
      const animationState = this.animationCoordinator.createPeacefulMoveAnimationState(
        move.gameState,
        sourceRegionIndex,
        targetRegionIndex,
        soldierCount
      );
      this.animationCoordinator.dispatchBattleStateUpdate(animationState);
      
      // Play movement sound
      this.animationCoordinator.playMoveSound();

      // Wait for CSS transition to complete (600ms transition + buffer)
      await new Promise(resolve => setTimeout(resolve, 700));

      // NOW execute on server to validate and persist
      const result = options?.localMode
        ? await this.localExecutor.execute(move, playerId)
        : await this.apiClient.executeMove(move, playerId);

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
   * Create battle state for immediate UI feedback
   */
  private createBattleState(gameState: GameStateData, battleRegionIndex: number, move: import('$lib/client/api/BattleApiClient').BattleMove): GameStateData {
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

  getBattleAnimationSystem(): BattleAnimationSystem {
    return this.battleAnimationSystem;
  }

  hasActiveBattles(): boolean {
    return this.timeoutManager.hasActiveBattles();
  }

  getActiveBattleRegions(): number[] {
    return this.timeoutManager.getActiveBattleRegions();
  }

  clearAllBattleTimeouts(): void {
    this.timeoutManager.clearAll();
  }

  destroy(): void {
    console.log('💥 BattleManager: Destroying and cleaning up');
    this.timeoutManager.clearAll();
  }
}
