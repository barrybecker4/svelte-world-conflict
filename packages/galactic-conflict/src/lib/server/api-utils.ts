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
export function validateRequired<T extends Record<string, unknown>>(
    body: T | null | undefined,
    fields: string[]
): string | null {
    if (!body || typeof body !== 'object') {
        return 'Request body is required';
    }

    for (const field of fields) {
        const value = body[field];
        if (value === undefined || value === null || value === '') {
            return `Missing required field: ${field}`;
        }
    }
    return null;
}

