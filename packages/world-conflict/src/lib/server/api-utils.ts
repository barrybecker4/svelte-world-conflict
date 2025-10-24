import type { Player } from '$lib/game/state/GameState';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { json } from '@sveltejs/kit';
import { AI_PERSONALITIES, AI_LEVELS } from '$lib/game/entities/aiPersonalities';

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
 * Standardized API error handler
 * Consolidates error logging and response formatting across all API endpoints
 *
 * @param error - The error that occurred
 * @param context - Description of what was being attempted (e.g., "loading game", "processing move")
 * @param status - HTTP status code (default: 500)
 * @returns JSON error response
 */
export function handleApiError(error: unknown, context: string, status: number = 500) {
    const errorMessage = getErrorMessage(error);
    console.error(`Error ${context}:`, error);
    return json({ error: errorMessage }, { status });
}

/**
 * Generate a unique player ID (though WC uses index, this can be useful for tracking)
 */
// export function generatePlayerId(): string {
//     return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// }

/**
 * Helper to get AI personalities matching a difficulty level
 */
function getPersonalitiesForDifficulty(difficulty?: string): any[] {
    if (!difficulty) {
        return [...AI_PERSONALITIES];
    }

    let targetLevel: number;
    switch (difficulty) {
        case 'Nice':
            targetLevel = AI_LEVELS.NICE;
            break;
        case 'Normal':
            targetLevel = AI_LEVELS.RUDE;
            break;
        case 'Hard':
            targetLevel = AI_LEVELS.MEAN;
            break;
        default:
            targetLevel = AI_LEVELS.RUDE;
    }

    const matchingPersonalities = AI_PERSONALITIES.filter(p => p.level === targetLevel);
    return matchingPersonalities.length > 0 ? matchingPersonalities : [...AI_PERSONALITIES];
}

/**
 * Create a properly typed World Conflict Player object
 * 
 * @param name - Player name
 * @param slotIndex - Slot index (0-3)
 * @param isAI - Whether this is an AI player
 * @param aiDifficulty - AI difficulty level (used to select appropriate personality)
 * @param personality - Explicit personality name (overrides difficulty-based selection)
 */
export function createPlayer(name: string, slotIndex: number, isAI: boolean = false, aiDifficulty?: string, personality?: string): Player {
    if (slotIndex < 0 || slotIndex > 3) {
        throw new Error(`Invalid player slot index: ${slotIndex}. Must be 0-3.`);
    }

    const player: Player = {
        slotIndex,
        name: name.trim(),
        color: getPlayerColor(slotIndex),
        isAI
    };

    // If AI player, assign personality based on difficulty or explicit value
    if (isAI) {
        if (personality) {
            player.personality = personality;
        } else {
            const availablePersonalities = getPersonalitiesForDifficulty(aiDifficulty);
            player.personality = availablePersonalities[slotIndex % availablePersonalities.length].name;
        }
    }

    return player;
}
