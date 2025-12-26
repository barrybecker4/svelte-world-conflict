/**
 * Move System Constants
 * 
 * This file defines all constants used by the Move System to avoid string duplication
 * and provide type safety. Constants are organized into three categories:
 * 
 * 1. SHARED: Values used in both MoveState.mode and MoveAction.type
 * 2. MODE_ONLY: Values only used in MoveState.mode
 * 3. ACTION_ONLY: Values only used in MoveAction.type
 */

// Shared constants - used in both mode and action type
export const SELECT_SOURCE = 'SELECT_SOURCE' as const;
export const ADJUST_SOLDIERS = 'ADJUST_SOLDIERS' as const;
export const SELECT_TARGET = 'SELECT_TARGET' as const;

// Mode-only constants
export const IDLE = 'IDLE' as const;
export const BUILD = 'BUILD' as const;

// Action-only constants
export const RESET = 'RESET' as const;
export const CANCEL = 'CANCEL' as const;
export const CONFIRM_MOVE = 'CONFIRM_MOVE' as const;
export const ENTER_BUILD_MODE = 'ENTER_BUILD_MODE' as const;

/**
 * Object containing all mode constants for easy access
 */
export const MOVE_MODES = {
  IDLE,
  SELECT_SOURCE,
  ADJUST_SOLDIERS,
  SELECT_TARGET,
  BUILD
} as const;

/**
 * Object containing all action type constants for easy access
 */
export const MOVE_ACTION_TYPES = {
  RESET,
  SELECT_SOURCE,
  ADJUST_SOLDIERS,
  SELECT_TARGET,
  CANCEL,
  CONFIRM_MOVE,
  ENTER_BUILD_MODE
} as const;

/**
 * Type for move modes derived from the constants
 */
export type MoveMode = typeof MOVE_MODES[keyof typeof MOVE_MODES];

/**
 * Type for move action types derived from the constants
 */
export type MoveActionType = typeof MOVE_ACTION_TYPES[keyof typeof MOVE_ACTION_TYPES];
