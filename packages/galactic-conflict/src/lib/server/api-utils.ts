/**
 * API utility functions for Galactic Conflict
 */

import { json } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import type { Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { getPlayerColor, getPlayerDefaultName } from '$lib/game/constants/playerConfigs';
import { logger } from 'multiplayer-framework/shared';

/**
 * Generate a unique game ID
 */
export function generateGameId(): string {
    return uuidv4().substring(0, 8);
}

/**
 * Create a Player object
 */
export function createPlayer(
    name: string,
    slotIndex: number,
    isAI: boolean,
    personality?: string,
    difficulty?: AiDifficulty
): Player {
    return {
        slotIndex,
        name: name.trim() || getPlayerDefaultName(slotIndex),
        color: getPlayerColor(slotIndex),
        isAI,
        personality,
        difficulty,
    };
}

/**
 * Handle API errors consistently
 */
export function handleApiError(
    error: unknown,
    context: string,
    options?: { platform?: App.Platform }
): Response {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error ${context}: ${message}`);
    
    return json(
        { error: message, context },
        { status: 500 }
    );
}

/**
 * Validate required fields in a request
 */
export function validateRequired(body: any, fields: string[]): string | null {
    for (const field of fields) {
        if (body[field] === undefined || body[field] === null || body[field] === '') {
            return `Missing required field: ${field}`;
        }
    }
    return null;
}

