import type { GameStateData } from '$lib/game/entities/gameTypes';
import type { StateSnapshot } from './types';

/**
 * Manages undo functionality by tracking state history
 */
export class UndoManager {
  private stateHistory: StateSnapshot[] = [];
  private undoDisabled: boolean = false;
  private currentPlayerSlot: number | null = null;

  /**
   * Check if undo is currently available
   */
  canUndo(gameState: GameStateData | null, playerSlot: number): boolean {
    if (!gameState) return false;
    if (this.stateHistory.length === 0) return false;
    if (this.currentPlayerSlot !== null && this.currentPlayerSlot !== playerSlot) return false;
    if (this.undoDisabled) return false;

    // Can't undo for AI players
    const currentPlayer = gameState.players?.find(p => p.slotIndex === playerSlot);
    if (currentPlayer?.isAI || currentPlayer?.personality) return false;

    return true;
  }

  /**
   * Save the current game state before making a move
   */
  saveState(gameState: GameStateData, playerSlot: number): void {
    const snapshot: StateSnapshot = {
      gameState: JSON.parse(JSON.stringify(gameState)),
      timestamp: Date.now()
    };

    this.stateHistory.push(snapshot);
    this.currentPlayerSlot = playerSlot;
  }

  /**
   * Undo the last move and return the previous state
   */
  undo(): GameStateData | null {
    if (this.stateHistory.length === 0) return null;

    const previousSnapshot = this.stateHistory.pop()!;
    return previousSnapshot.gameState;
  }

  /**
   * Reset everything (called when turn changes)
   */
  reset(): void {
    this.stateHistory = [];
    this.undoDisabled = false;
    this.currentPlayerSlot = null;
  }

  /**
   * Disable undo (e.g., after a battle)
   */
  disableUndo(): void {
    this.undoDisabled = true;
  }
}
