import type { Player } from '$lib/game/state/GameState';
import type { AiPersonalityData } from '$lib/game/entities/AiPersonality';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { json } from '@sveltejs/kit';
import { AI_PERSONALITIES } from '$lib/game/entities/aiPersonalities';
import { getAiLevelFromDifficulty } from '$lib/server/ai/AiHeuristics';
import { GameStatsService } from '$lib/server/storage/GameStatsService';
import { logger } from 'multiplayer-framework/shared';

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
    return `wc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Options for handleApiError
 */
export interface HandleApiErrorOptions {
    status?: number;
    platform?: App.Platform;
    gameId?: string;
}

/**
 * Standardized API error handler
 * Consolidates error logging and response formatting across all API endpoints
 *
 * @param error - The error that occurred
 * @param context - Description of what was being attempted (e.g., "loading game", "processing move")
 * @param statusOrOptions - HTTP status code (default: 500) or options object
 * @returns JSON error response
 */
export function handleApiError(
    error: unknown, 
    context: string, 
    statusOrOptions: number | HandleApiErrorOptions = 500
) {
    const options: HandleApiErrorOptions = typeof statusOrOptions === 'number' 
        ? { status: statusOrOptions } 
        : statusOrOptions;
    
    const { status = 500, platform, gameId } = options;
    
    const errorMessage = getErrorMessage(error);
    logger.error(`Error ${context}:`, error);
    
    // Record error in daily statistics if platform is available
    if (platform) {
        const statsService = GameStatsService.create(platform);
        const errorObj = error instanceof Error ? error : new Error(errorMessage);
        // Fire and forget - don't block the error response
        statsService.recordError(errorObj, gameId).catch(recordError => {
            logger.error('Failed to record error in stats:', recordError);
        });
    }
    
    return json({ error: errorMessage }, { status });
}

/**
 * Helper to get AI personalities matching a difficulty level
 */
function getPersonalitiesForDifficulty(difficulty?: string): readonly AiPersonalityData[] {
    if (!difficulty) {
        return AI_PERSONALITIES;
    }

    const targetLevel = getAiLevelFromDifficulty(difficulty);
    const matchingPersonalities = AI_PERSONALITIES.filter(p => p.level === targetLevel);
    return matchingPersonalities.length > 0 ? matchingPersonalities : AI_PERSONALITIES;
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
export function createPlayer(
    name: string,
    slotIndex: number,
    isAI: boolean = false,
    aiDifficulty?: string,
    personality?: string
): Player {
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
