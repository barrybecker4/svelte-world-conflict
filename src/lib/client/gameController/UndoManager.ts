import type { GameStateData } from '$lib/game/entities/gameTypes';
import type { PendingMove, StateSnapshot } from './types';

/**
 * Manages undo functionality by tracking state history and pending moves
 * Similar to the old GAS implementation's undoManager.js.html
 */
export class UndoManager {
  private stateHistory: StateSnapshot[] = [];
  private pendingMoves: PendingMove[] = [];
  private undoDisabled: boolean = false;
  private currentPlayerSlot: number | null = null;
  
  /**
   * Check if undo is currently enabled
   */
  canUndo(gameState: GameStateData | null, playerSlot: number): boolean {
    if (!gameState) {
      console.log('🔍 canUndo: false - no gameState');
      return false;
    }
    
    // Must have at least one saved state to undo to
    if (this.stateHistory.length === 0) {
      console.log('🔍 canUndo: false - no state history (length: 0)');
      return false;
    }
    
    // Must be the same player who made the moves
    if (this.currentPlayerSlot !== null && this.currentPlayerSlot !== playerSlot) {
      console.log(`🔍 canUndo: false - player mismatch (current: ${this.currentPlayerSlot}, requesting: ${playerSlot})`);
      return false;
    }
    
    // Undo disabled after certain actions (like battles)
    if (this.undoDisabled) {
      console.log('🔍 canUndo: false - undo disabled flag set');
      return false;
    }
    
    // Can't undo for AI players
    const currentPlayer = gameState.players?.find(p => p.slotIndex === playerSlot);
    if (currentPlayer?.isAI || currentPlayer?.personality) {
      console.log('🔍 canUndo: false - AI player');
      return false;
    }
    
    console.log(`✅ canUndo: true - ${this.stateHistory.length} states in history, ${this.pendingMoves.length} pending moves`);
    return true;
  }
  
  /**
   * Save the current game state before making a move
   */
  saveState(gameState: GameStateData, playerSlot: number): void {
    // Deep clone the game state to prevent mutations
    const snapshot: StateSnapshot = {
      gameState: JSON.parse(JSON.stringify(gameState)),
      timestamp: Date.now()
    };
    
    this.stateHistory.push(snapshot);
    this.currentPlayerSlot = playerSlot;
    
    console.log(`💾 UndoManager: State saved (${this.stateHistory.length} states in history)`);
  }
  
  /**
   * Undo the last move and return the previous state
   */
  undo(): GameStateData | null {
    if (this.stateHistory.length === 0) {
      console.warn('⚠️ UndoManager: No states to undo');
      return null;
    }
    
    // Get the most recent saved state (the state before the last move)
    const previousSnapshot = this.stateHistory[this.stateHistory.length - 1];
    
    // Remove this state from history (since we're undoing to it)
    this.stateHistory.pop();
    
    // Remove the most recent move
    if (this.pendingMoves.length > 0) {
      this.pendingMoves.pop();
    }
    
    console.log(`↩️ UndoManager: Undo to state from ${new Date(previousSnapshot.timestamp).toISOString()}`);
    console.log(`↩️ UndoManager: ${this.stateHistory.length} states remaining in history, ${this.pendingMoves.length} pending moves remaining`);
    
    return previousSnapshot.gameState;
  }
  
  /**
   * Add a move to the pending moves list
   */
  addMove(move: PendingMove): void {
    this.pendingMoves.push(move);
    console.log(`📝 UndoManager: Move added (${this.pendingMoves.length} pending moves)`, move);
  }
  
  /**
   * Get all pending moves that need to be sent to the server
   */
  getPendingMoves(): PendingMove[] {
    return [...this.pendingMoves];
  }
  
  /**
   * Clear all pending moves (called after successful turn end)
   */
  clearMoves(): void {
    this.pendingMoves = [];
    console.log('🗑️ UndoManager: Pending moves cleared');
  }
  
  /**
   * Clear all state history (called at turn end or turn start)
   */
  clearHistory(): void {
    this.stateHistory = [];
    this.currentPlayerSlot = null;
    console.log('🗑️ UndoManager: State history cleared');
  }
  
  /**
   * Reset everything (called when turn changes)
   */
  reset(): void {
    this.stateHistory = [];
    this.pendingMoves = [];
    this.undoDisabled = false;
    this.currentPlayerSlot = null;
    console.log('🔄 UndoManager: Reset complete');
  }
  
  /**
   * Disable undo (e.g., after a battle)
   */
  disableUndo(): void {
    this.undoDisabled = true;
    console.log('🚫 UndoManager: Undo disabled');
  }
  
  /**
   * Enable undo
   */
  enableUndo(): void {
    this.undoDisabled = false;
    console.log('✅ UndoManager: Undo enabled');
  }
  
  /**
   * Get the number of pending moves
   */
  getPendingMoveCount(): number {
    return this.pendingMoves.length;
  }
  
  /**
   * Check if there are any pending moves
   */
  hasPendingMoves(): boolean {
    return this.pendingMoves.length > 0;
  }
}

