/**
 * Represents the current state of the move system
 * Used to track progress through the three-step move process:
 * 1. Select source region
 * 2. Select destination region
 * 3. Adjust soldier count
 */
export interface MoveState {
  /** Current mode of the move system */
  mode: 'IDLE' | 'SELECT_SOURCE' | 'ADJUST_SOLDIERS' | 'SELECT_TARGET' | 'BUILD';

  /** Index of the selected source region, null if none selected */
  sourceRegion: number | null;

  /** Index of the selected target region, null if none selected */
  targetRegion: number | null;

  /** Number of soldiers currently selected for the move */
  selectedSoldierCount: number;

  /** Maximum number of soldiers available for the move */
  maxSoldiers: number;

  /** Number of moves remaining in the current turn */
  availableMoves: number;

  /** Whether a move is currently being executed */
  isMoving: boolean;
}

/**
 * Action types for move system state transitions
 * Follows Redux-style action pattern for predictable state updates
 */
export interface MoveAction {
  /** The type of action to perform */
  type: 'RESET' | 'SELECT_SOURCE' | 'ADJUST_SOLDIERS' | 'SELECT_TARGET' | 'CANCEL' | 'CONFIRM_MOVE' | 'ENTER_BUILD_MODE';

  /** Optional payload data for the action */
  payload?: {
    /** Region index for region-related actions */
    regionIndex?: number;
    /** Soldier count for soldier-related actions */
    soldierCount?: number;
  };
}

/**
 * Callback function type for move state changes
 * Used by components to react to move system state updates
 */
export type MoveStateChangeCallback = (newState: MoveState) => void;

/**
 * Callback function type for completed moves
 * Used to execute the actual move logic after UI interaction
 */
export type MoveCompleteCallback = (
  sourceRegionIndex: number,
  targetRegionIndex: number,
  soldierCount: number
) => Promise<void>;

/**
 * Helper type for move mode checks
 * Useful for component logic that needs to check specific modes
 */
export type MoveMode = MoveState['mode'];

/**
 * Utility type for creating partial move state updates
 * Useful for state management and testing
 */
export type PartialMoveState = Partial<MoveState>;
