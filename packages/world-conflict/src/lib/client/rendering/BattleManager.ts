import { BattleAnimationSystem } from './BattleAnimationSystem';
import { AnimationStateCoordinator } from './AnimationStateCoordinator';
import { BattleTimeoutManager } from './BattleTimeoutManager';
import type { BattleMove, BattleResult } from '$lib/client/gameController/GameApiClient';
import { LocalMoveExecutor } from '$lib/client/gameController/LocalMoveExecutor';
import type { Region, GameStateData } from '$lib/game/entities/gameTypes';
import type { AttackEvent } from '$lib/game/mechanics/AttackSequenceGenerator';
import { clearBattleState, isExpectedValidationError } from '$lib/game/utils/GameStateUtils';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from '$lib/game/utils/logger';

// Re-export types for backward compatibility
export type { BattleMove, BattleResult };

/**
 * Manages all battle-related operations including animations, timeouts, and state coordination
 */
export class BattleManager {
  private battleAnimationSystem: BattleAnimationSystem;
  private animationCoordinator: AnimationStateCoordinator;
  private timeoutManager: BattleTimeoutManager;
  private localExecutor: LocalMoveExecutor;
  private playerSlotIndex: number;

  constructor(playerSlotIndex: number, mapContainer?: HTMLElement) {
    this.playerSlotIndex = playerSlotIndex;
    this.battleAnimationSystem = new BattleAnimationSystem();
    this.animationCoordinator = new AnimationStateCoordinator();
    this.timeoutManager = new BattleTimeoutManager();
    this.localExecutor = new LocalMoveExecutor();

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

  async executeMove(move: BattleMove, regions: Region[]): Promise<BattleResult> {
    if (this.isBattleRequired(move)) {
      return this.executeBattle(move, regions);
    } else {
      return this.executePeacefulMove(move);
    }
  }

  async executeBattle(move: BattleMove, regions: Region[]): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    logger.debug('BattleManager: Starting battle execution', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      const result = await this.executeBattleSequence(move, regions, sourceRegionIndex, targetRegionIndex, soldierCount);
      return result;

    } catch (error) {
      return this.handleBattleError(error, targetRegionIndex, move);
    }
  }

  private async executeBattleSequence(
    move: BattleMove,
    regions: Region[],
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<BattleResult> {
    this.timeoutManager.startBattleTimeout(targetRegionIndex);

    const animationState = await this.startBattleAnimation(move, sourceRegionIndex, targetRegionIndex, soldierCount);
    
    // Execute move locally instead of sending to server
    const result = this.localExecutor.executeArmyMove(
      move.gameState,
      this.playerSlotIndex,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );

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
  ): Promise<GameStateData> {
    const animationState = this.animationCoordinator.createAttackingAnimationState(
      move.gameState,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );
    this.animationCoordinator.dispatchBattleStateUpdate(animationState);

    // Wait for soldiers to animate halfway
    await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS));

    return animationState;
  }

  private async playBattleEffects(
    result: BattleResult,
    animationState: GameStateData,
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
    await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.SMOKE_WAIT_MS));
  }

  private async animateConqueringMove(
    animationState: GameStateData,
    result: BattleResult,
    sourceRegionIndex: number,
    targetRegionIndex: number
  ): Promise<void> {
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
    if (!isExpectedValidationError(errorMessage)) {
      logger.error('BattleManager: Battle failed:', error);
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
  async executePeacefulMove(move: BattleMove): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    logger.debug('BattleManager: Executing peaceful move', {
      source: sourceRegionIndex,
      target: targetRegionIndex,
      soldiers: soldierCount
    });

    try {
      const result = await this.executePeacefulMoveSequence(move, sourceRegionIndex, targetRegionIndex, soldierCount);
      return result;

    } catch (error) {
      return this.handlePeacefulMoveError(error);
    }
  }

  private async executePeacefulMoveSequence(
    move: BattleMove,
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<BattleResult> {
    // Wait for next frame to ensure current state is rendered
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

    await this.playPeacefulMoveAnimation(move, sourceRegionIndex, targetRegionIndex, soldierCount);

    // Execute move locally instead of sending to server
    const result = this.localExecutor.executeArmyMove(
      move.gameState,
      this.playerSlotIndex,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );

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
    await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS));
  }

  private handlePeacefulMoveError(error: unknown): BattleResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown move error';
    // Don't log validation errors as console errors - they're expected game rules
    if (!isExpectedValidationError(errorMessage)) {
      logger.error('BattleManager: Peaceful move failed:', error);
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
    attackSequence: AttackEvent[],
    regions?: Region[],
    sourceRegion?: number,
    targetRegion?: number
  ): Promise<void> {
    try {
      // Create callback to incrementally remove soldiers during animation
      const onStateUpdate = (attackerCasualties: number, defenderCasualties: number) => {
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
    } catch (error) {
      logger.warn('BattleManager: Animation failed, continuing without animation:', error);
    }
  }


  getBattleAnimationSystem(): BattleAnimationSystem {
    return this.battleAnimationSystem;
  }

  destroy(): void {
    this.timeoutManager.clearAll();
  }
}
