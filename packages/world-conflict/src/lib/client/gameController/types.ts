/**
 * Represents a saved game state snapshot for undo functionality
 */
export interface StateSnapshot {
  gameState: any; // GameStateData
  timestamp: number;
}