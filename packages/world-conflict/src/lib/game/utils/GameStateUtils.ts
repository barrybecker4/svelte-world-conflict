import type { GameStateData } from '$lib/game/entities/gameTypes';

/**
 * Utility functions for game state manipulation
 * Consolidates common patterns used across the codebase
 */

/**
 * Clear battle-related transient state from game state
 * Used to ensure WebSocket updates don't carry temporary battle flags
 */
export function clearBattleState(gameState: GameStateData): GameStateData {
    return {
        ...gameState,
        battlesInProgress: [],
        pendingMoves: []
    };
}

/**
 * Deep clone game state using JSON serialization
 * Useful for creating animation states without affecting the original
 */
export function cloneGameState(gameState: GameStateData): GameStateData {
    return JSON.parse(JSON.stringify(gameState));
}

/**
 * Check if an error message is an expected validation error
 * (as opposed to an unexpected system error)
 */
export function isExpectedValidationError(message: string): boolean {
    return (
        message.includes('conquered') ||
        message.includes('No moves remaining') ||
        message.includes('not owned by') ||
        message.includes('Invalid')
    );
}
