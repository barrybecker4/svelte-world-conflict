import { BattleAnimationSystem } from './BattleAnimationSystem';
import { AnimationStateCoordinator } from './AnimationStateCoordinator';
import { BattleTimeoutManager } from './BattleTimeoutManager';
import { LocalMoveExecutor } from './LocalMoveExecutor';
import { GameApiClient, type BattleMove, type BattleResult } from '$lib/client/gameController/GameApiClient';
import type { Region } from '$lib/game/entities/gameTypes';
import { clearBattleState, isExpectedValidationError } from '$lib/game/utils/GameStateUtils';

// Re-export types for backward compatibility
export type { BattleMove, BattleResult };

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
  private apiClient: GameApiClient;
  private gameId: string;

  constructor(gameId: string, mapContainer?: HTMLElement) {
    this.gameId = gameId;
    this.battleAnimationSystem = new BattleAnimationSystem();
    this.animationCoordinator = new AnimationStateCoordinator();
    this.timeoutManager = new BattleTimeoutManager();
    this.localExecutor = new LocalMoveExecutor();
    this.apiClient = new GameApiClient(gameId);

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
      const result = await this.executeBattleSequence(move, playerId, regions, options, sourceRegionIndex, targetRegionIndex, soldierCount);
      console.log('✅ BattleManager: Battle completed successfully');
      return result;

    } catch (error) {
      return this.handleBattleError(error, targetRegionIndex, move);
    }
  }

  private async executeBattleSequence(
    move: BattleMove,
    playerId: string,
    regions: Region[],
    options: ExecuteMoveOptions | undefined,
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<BattleResult> {
    this.timeoutManager.startBattleTimeout(targetRegionIndex);

    const animationState = await this.startBattleAnimation(move, sourceRegionIndex, targetRegionIndex, soldierCount);
    const result = await this.executeMoveOnServer(move, playerId, options);

    if (!result.success) {
      throw new Error(result.error || 'Battle failed');
    }

    await this.playBattleEffects(result, animationState, regions, sourceRegionIndex, targetRegionIndex);
    
    this.timeoutManager.clearBattleTimeout(targetRegionIndex);

    if (result.gameState) {
      result.gameState = clearBattleState(result.gameState);
    }

    return result;
  }

  private async startBattleAnimation(
    move: BattleMove,
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<any> {
    const animationState = this.animationCoordinator.createAttackingAnimationState(
      move.gameState,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );
    this.animationCoordinator.dispatchBattleStateUpdate(animationState);

    // Wait for soldiers to animate halfway
    await new Promise(resolve => setTimeout(resolve, 700));

    return animationState;
  }

  private async executeMoveOnServer(
    move: BattleMove,
    playerId: string,
    options: ExecuteMoveOptions | undefined
  ): Promise<BattleResult> {
    return options?.localMode
      ? await this.localExecutor.execute(move, playerId)
      : await this.apiClient.executeMove(move, playerId);
  }

  private async playBattleEffects(
    result: BattleResult,
    animationState: any,
    regions: Region[],
    sourceRegionIndex: number,
    targetRegionIndex: number
  ): Promise<void> {
    if (result.attackSequence && result.attackSequence.length > 0) {
      await this.playBattleAnimation(result.attackSequence, regions, sourceRegionIndex, targetRegionIndex);
      await this.waitForSmokeEffects();
      await this.animateConqueringMove(animationState, result, sourceRegionIndex, targetRegionIndex);
    }
  }

  private async waitForSmokeEffects(): Promise<void> {
    // Smoke takes 3.05s (matching old GAS version), and the last smoke starts ~600ms before animation completes
    // So we need to wait (3050ms - 600ms) = 2450ms more
    console.log('⏳ Waiting for smoke effects to complete...');
    await new Promise(resolve => setTimeout(resolve, 2500));
    console.log('✅ Smoke effects complete');
  }

  private async animateConqueringMove(
    animationState: any,
    result: BattleResult,
    sourceRegionIndex: number,
    targetRegionIndex: number
  ): Promise<void> {
    console.log('🏃 Animating conquering soldiers into target region...');
    await this.animationCoordinator.animateConqueringMove(
      animationState,
      result.gameState!,
      sourceRegionIndex,
      targetRegionIndex
    );
  }

  private handleBattleError(error: unknown, targetRegionIndex: number, move: BattleMove): BattleResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown battle error';
    // Don't log validation errors as console errors - they're expected game rules
    if (isExpectedValidationError(errorMessage)) {
      console.log('⚠️ BattleManager: Move not allowed -', errorMessage);
    } else {
      console.error('❌ BattleManager: Battle failed:', error);
    }
    this.timeoutManager.clearBattleTimeout(targetRegionIndex);

    return {
      success: false,
      error: errorMessage,
      gameState: clearBattleState(move.gameState)
    };
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
      const result = await this.executePeacefulMoveSequence(move, playerId, options, sourceRegionIndex, targetRegionIndex, soldierCount);
      console.log('✅ BattleManager: Peaceful move completed successfully');
      this.logFinalMoveState(result, sourceRegionIndex, targetRegionIndex);
      return result;

    } catch (error) {
      return this.handlePeacefulMoveError(error);
    }
  }

  private async executePeacefulMoveSequence(
    move: BattleMove,
    playerId: string,
    options: ExecuteMoveOptions | undefined,
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<BattleResult> {
    console.log(`🚶 Player Move: ${soldierCount} soldiers moving from ${sourceRegionIndex} to ${targetRegionIndex}`);

    // Wait for next frame to ensure current state is rendered
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    await this.playPeacefulMoveAnimation(move, sourceRegionIndex, targetRegionIndex, soldierCount);

    const result = await this.executeMoveOnServer(move, playerId, options);

    if (!result.success) {
      throw new Error(result.error || 'Move failed');
    }

    return result;
  }

  private async playPeacefulMoveAnimation(
    move: BattleMove,
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<void> {
    const animationState = this.animationCoordinator.createPeacefulMoveAnimationState(
      move.gameState,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );
    this.animationCoordinator.dispatchBattleStateUpdate(animationState);
    this.animationCoordinator.playMoveSound();

    // Wait for CSS transition to complete (600ms transition + buffer)
    await new Promise(resolve => setTimeout(resolve, 700));
  }

  private logFinalMoveState(result: BattleResult, sourceRegionIndex: number, targetRegionIndex: number): void {
    if (result.gameState) {
      const finalSourceSoldiers = result.gameState.soldiersByRegion?.[sourceRegionIndex] || [];
      const finalTargetSoldiers = result.gameState.soldiersByRegion?.[targetRegionIndex] || [];
      console.log(`📊 FINAL STATE - Source ${sourceRegionIndex} has ${finalSourceSoldiers.length} soldiers:`, finalSourceSoldiers.map(s => s.i));
      console.log(`📊 FINAL STATE - Target ${targetRegionIndex} has ${finalTargetSoldiers.length} soldiers:`, finalTargetSoldiers.map(s => s.i));
    }
  }

  private handlePeacefulMoveError(error: unknown): BattleResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown move error';
    // Don't log validation errors as console errors - they're expected game rules
    if (isExpectedValidationError(errorMessage)) {
      console.log('⚠️ BattleManager: Move not allowed -', errorMessage);
    } else {
      console.error('❌ BattleManager: Peaceful move failed:', error);
    }

    return {
      success: false,
      error: errorMessage
    };
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


  getBattleAnimationSystem(): BattleAnimationSystem {
    return this.battleAnimationSystem;
  }

  destroy(): void {
    console.log('💥 BattleManager: Destroying and cleaning up');
    this.timeoutManager.clearAll();
  }
}
