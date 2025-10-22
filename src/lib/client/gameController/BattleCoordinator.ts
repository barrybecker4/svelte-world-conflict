import { get } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { UndoManager } from './UndoManager';

/**
 * Coordinates battle execution, animations, and player elimination detection
 * Extracted from GameController to isolate battle-specific logic
 */
export class BattleCoordinator {
  private battleManager: BattleManager;
  private undoManager: UndoManager;
  private gameStore: any;
  private playerId: string;
  private battleInProgress = false;

  constructor(
    gameId: string,
    playerId: string,
    gameStore: any,
    undoManager: UndoManager
  ) {
    this.playerId = playerId;
    this.gameStore = gameStore;
    this.undoManager = undoManager;
    this.battleManager = new BattleManager(gameId, null as any);
  }

  /**
   * Get the battle manager instance
   */
  getBattleManager(): BattleManager {
    return this.battleManager;
  }

  /**
   * Check if a battle is currently in progress
   */
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
    const gameState = this.gameStore.gameState;
    let currentState: GameStateData;

    gameState.subscribe((value: GameStateData) => {
      currentState = value;
    })();

    // Save state before making the move (for undo)
    const playerSlotIndex = parseInt(this.playerId);
    this.undoManager.saveState(currentState!, playerSlotIndex);

    const battleMove = {
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      gameState: currentState!
    };

    // Get regions for animations
    const regions = this.gameStore.regions;
    let currentRegions: any[];
    regions.subscribe((value: any[]) => {
      currentRegions = value;
    })();

    // Mark battle as in progress to delay WebSocket updates
    this.battleInProgress = true;
    console.log('🔒 Battle in progress, WebSocket updates will be delayed');
    
    // Execute move through BattleManager (sends to server immediately for validation and persistence)
    const result = await this.battleManager.executeMove(battleMove, this.playerId, currentRegions!);

    if (!result.success) {
      throw new Error(result.error || 'Move failed');
    }

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
    
    // Clear battle in progress flag
    this.battleInProgress = false;
    console.log('🔓 Battle complete, WebSocket updates resumed');
  }

  /**
   * Check for player eliminations and show banners immediately
   */
  private checkForEliminations(gameState: GameStateData): void {
    const players = gameState.players || [];
    const ownersByRegion = gameState.ownersByRegion || {};

    // Count regions owned by each player
    const regionCounts = new Map<number, number>();
    for (const playerSlotIndex of Object.values(ownersByRegion)) {
      regionCounts.set(playerSlotIndex, (regionCounts.get(playerSlotIndex) || 0) + 1);
    }

    // Check each player - if they have 0 regions, they're eliminated
    for (const player of players) {
      const regionCount = regionCounts.get(player.slotIndex) || 0;
      if (regionCount === 0) {
        console.log(`💀 Player ${player.name} (slot ${player.slotIndex}) has been eliminated!`);
        this.gameStore.showEliminationBanner(player.slotIndex);
      }
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

