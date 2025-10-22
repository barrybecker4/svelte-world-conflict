import { GameApiClient } from './GameApiClient';
import { UndoManager } from './UndoManager';

/**
 * Coordinates temple-specific actions like purchasing upgrades
 * Extracted from GameController to isolate temple-related logic
 */
export class TempleActionCoordinator {
  private apiClient: GameApiClient;
  private undoManager: UndoManager;
  private playerId: string;
  private gameStore: any;

  constructor(
    playerId: string,
    apiClient: GameApiClient,
    undoManager: UndoManager,
    gameStore: any
  ) {
    this.playerId = playerId;
    this.apiClient = apiClient;
    this.undoManager = undoManager;
    this.gameStore = gameStore;
  }

  /**
   * Purchase an upgrade for a temple
   * Note: Temple upgrades are sent immediately to the server and cannot be undone
   */
  async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
    try {
      const data = await this.apiClient.purchaseUpgrade(this.playerId, regionIndex, upgradeIndex);

      // Temple upgrades are immediate operations, so disable undo
      // (similar to how battles disable undo in the old GAS implementation)
      this.undoManager.disableUndo();
      console.log('🏛️ Temple upgrade purchased - undo disabled');

      // Update game state
      if (data.gameState) {
        this.gameStore.handleGameStateUpdate(data.gameState);
      }

      // Don't close the panel - keep it open so player can see updated options
      // and potentially purchase additional upgrades (like the second level)
      console.log('💰 Purchase complete, panel remains open for additional purchases');

    } catch (error) {
      console.error('❌ Purchase upgrade error:', error);
      alert('Error purchasing upgrade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
}

