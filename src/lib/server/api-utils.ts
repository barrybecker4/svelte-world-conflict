import type { Player } from '$lib/game/state/GameState';

// Update with your deployed worker URL. i.e. replace "barrybecker4", with your username, if needed.
export const WORKER_URL = 'https://svelte-world-conflict-websocket.barrybecker4.workers.dev';

/**
 * Helper function to safely get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Generate a unique game ID
 */
export function generateGameId(): string {
    return `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique player ID (though WC uses index, this can be useful for tracking)
 */
export function generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


/**
 * Create a properly typed World Conflict Player object
 */
export function createPlayer(name: string, slotIndex: number, isAI: boolean = false): Player {
    if (slotIndex < 0 || slotIndex > 3) {
        throw new Error(`Invalid player slot index: ${slotIndex}. Must be 0-3.`);
    }

    return {
        slotIndex,  // Changed from 'index'
        name: name.trim(),
        isAI
    };
}
