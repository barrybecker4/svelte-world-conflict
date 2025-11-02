import { get } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { UndoManager } from './UndoManager';
import { MoveQueue } from './MoveQueue';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';

/**
 * Coordinates battle execution, animations, and player elimination detection
 * Extracted from GameController to isolate battle-specific logic
 */
export class BattleCoordinator {
  private battleManager: BattleManager;
  private undoManager: UndoManager;
  private moveQueue: MoveQueue;
  private gameStore: any;
  private playerId: string;
  private battleInProgress = false;

  constructor(
    playerId: string,
    gameStore: any,
    undoManager: UndoManager,
    moveQueue: MoveQueue
  ) {
    this.playerId = playerId;
    this.gameStore = gameStore;
    this.undoManager = undoManager;
    this.moveQueue = moveQueue;
    this.battleManager = new BattleManager(parseInt(playerId), null as any);
  }

  getBattleManager(): BattleManager {
    return this.battleManager;
  }

  isBattleInProgress(): boolean {
    return this.battleInProgress;
  }

  /**
   * Handle move completion - execute through BattleManager with animations
   * Returns a callback to update tooltips after the battle completes
   */
  async handleMoveComplete(
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number,
    onTooltipUpdate: () => void
  ): Promise<void> {
    const currentState = this.getCurrentGameState();
    const { battleMove, currentRegions } = this.prepareForBattle(
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      currentState
    );

    this.battleInProgress = true;
    console.log('🔒 Battle in progress, WebSocket updates will be delayed');

    const result = await this.battleManager.executeMove(battleMove, currentRegions);

    if (!result.success) {
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
   * Get the current game state from the store
   */
  private getCurrentGameState(): GameStateData {
    let currentState: GameStateData;
    this.gameStore.gameState.subscribe((value: GameStateData) => {
      currentState = value;
    })();
    return currentState!;
  }

  /**
   * Prepare for battle by saving undo state and gathering required data
   */
  private prepareForBattle(
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number,
    currentState: GameStateData
  ): { battleMove: any; currentRegions: any[] } {
    // Save state before making the move (for undo)
    const playerSlotIndex = parseInt(this.playerId);
    this.undoManager.saveState(currentState, playerSlotIndex);

    const battleMove = {
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      gameState: currentState
    };

    // Get regions for animations
    let currentRegions: any[];
    this.gameStore.regions.subscribe((value: any[]) => {
      currentRegions = value;
    })();

    return { battleMove, currentRegions: currentRegions! };
  }

  /**
   * Complete battle by checking eliminations and updating game state
   */
  private completeBattle(result: any, onTooltipUpdate: () => void): void {
    // Check for player eliminations after the move
    if (result.gameState) {
      this.checkForEliminations(result.gameState);
    }

    // Update tutorial tooltips after move completes
    onTooltipUpdate();

    // Immediately update game state with the result from server
    if (result.gameState) {
      console.log('✅ BattleCoordinator: Updating game state from server response');
      this.gameStore.handleGameStateUpdate(result.gameState);
    }

    // Only disable undo if this was an actual battle (has attackSequence)
    // Peaceful moves into unoccupied regions should remain undoable
    if (result.attackSequence && result.attackSequence.length > 0) {
      this.undoManager.disableUndo();
      console.log('🚫 Battle completed - undo disabled');
    } else {
      console.log('✅ Peaceful move completed - undo still available');
    }

    // Clear battle in progress flag
    this.battleInProgress = false;
    console.log('🔓 Move complete, WebSocket updates resumed');
  }

  /**
   * Check for player eliminations and show banners immediately
   */
  private checkForEliminations(gameState: GameStateData): void {
    const eliminatedPlayers = PlayerEliminationService.checkForEliminations(gameState);

    // Show elimination banners for each eliminated player
    for (const playerSlotIndex of eliminatedPlayers) {
      this.gameStore.showEliminationBanner(playerSlotIndex);
    }
  }

  /**
   * Set the map container for battle animations
   */
  setMapContainer(container: HTMLElement): void {
    this.battleManager.setMapContainer(container);
  }

  /**
   * Get the battle animation system
   */
  getBattleAnimationSystem() {
    return this.battleManager.getBattleAnimationSystem();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.battleManager?.destroy();
  }
}
