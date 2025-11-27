import { get, writable, type Writable } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { UndoManager } from './UndoManager';
import { MoveQueue } from './MoveQueue';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';

/**
 * Coordinates battle execution, animations, and player elimination detection
 */
export class BattleCoordinator {
  private battleManager: BattleManager;
  private undoManager: UndoManager;
  private moveQueue: MoveQueue;
  private gameStore: any;
  private readonly playerSlotIndex: number;
  private battleInProgressStore: Writable<boolean> = writable(false);

  constructor(
    playerId: string,
    gameStore: any,
    undoManager: UndoManager,
    moveQueue: MoveQueue
  ) {
    this.playerSlotIndex = parseInt(playerId);
    this.gameStore = gameStore;
    this.undoManager = undoManager;
    this.moveQueue = moveQueue;
    this.battleManager = new BattleManager(this.playerSlotIndex, null as any);
  }

  getBattleManager(): BattleManager {
    return this.battleManager;
  }

  isBattleInProgress(): boolean {
    return get(this.battleInProgressStore);
  }

  getBattleInProgressStore(): Writable<boolean> {
    return this.battleInProgressStore;
  }

  /**
   * Handle move completion - execute through BattleManager with animations
   */
  async handleMoveComplete(
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number,
    onTooltipUpdate: () => void
  ): Promise<void> {
    const currentState = get(this.gameStore.gameState) as GameStateData;
    const currentRegions = get(this.gameStore.regions) as any[];

    // Save state before making the move (for undo)
    this.undoManager.saveState(currentState, this.playerSlotIndex);

    const battleMove = {
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      gameState: currentState
    };

    this.battleInProgressStore.set(true);

    const result = await this.battleManager.executeMove(battleMove, currentRegions);

    if (!result.success) {
      this.battleInProgressStore.set(false);
      throw new Error(result.error || 'Move failed');
    }

    // Queue the move to be sent to server at turn end
    this.moveQueue.push({
      type: 'ARMY_MOVE',
      source: sourceRegionIndex,
      destination: targetRegionIndex,
      count: soldierCount
    });

    this.completeBattle(result, onTooltipUpdate);
  }

  /**
   * Complete battle by checking eliminations and updating game state
   */
  private completeBattle(result: any, onTooltipUpdate: () => void): void {
    // Check for player eliminations after the move
    if (result.gameState) {
      const eliminatedPlayers = PlayerEliminationService.checkForEliminations(result.gameState);
      for (const playerSlotIndex of eliminatedPlayers) {
        this.gameStore.showEliminationBanner(playerSlotIndex);
      }
    }

    onTooltipUpdate();

    if (result.gameState) {
      this.gameStore.handleGameStateUpdate(result.gameState);
    }

    // Only disable undo if this was an actual battle (has attackSequence)
    if (result.attackSequence && result.attackSequence.length > 0) {
      this.undoManager.disableUndo();
    }

    this.battleInProgressStore.set(false);
  }

  setMapContainer(container: HTMLElement): void {
    this.battleManager.setMapContainer(container);
  }

  getBattleAnimationSystem() {
    return this.battleManager.getBattleAnimationSystem();
  }

  destroy(): void {
    this.battleManager?.destroy();
  }
}
