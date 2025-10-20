/**
 * Represents a move that has been executed locally but not yet sent to the server
 */
export interface PendingMove {
  type: 'ARMY_MOVE' | 'BUILD';
  
  // For ARMY_MOVE
  source?: number;
  destination?: number;
  count?: number;
  
  // For BUILD (temple upgrades)
  regionIndex?: number;
  upgradeIndex?: number;
}

/**
 * Represents a saved game state snapshot for undo functionality
 */
export interface StateSnapshot {
  gameState: any; // GameStateData
  timestamp: number;
}

