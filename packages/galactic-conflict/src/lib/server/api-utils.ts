/**
 * API utility functions for Galactic Conflict
 */

import { json } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import type { Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { getPlayerColor, getPlayerDefaultName } from '$lib/game/constants/playerConfigs';
import { logger } from 'multiplayer-framework/shared';
import { GameStorage, VersionConflictError, type GameRecord } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';

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

/**
 * Load and validate an active game WITHOUT processing events.
 *
 * Event processing should only happen in EventProcessor to avoid race conditions
 * where multiple requests process the same events and broadcast conflicting state.
 *
 * User actions (send armada, build ships, resign) should ONLY make their specific
 * changes to the state, not process unrelated events like resource ticks.
 */
export async function loadActiveGame(
    gameStorage: GameStorage,
    gameId: string
): Promise<{ gameRecord: GameRecord; gameState: GalacticGameState; expectedLastUpdateAt: number }> {
    const gameRecord = await gameStorage.loadGame(gameId);

    if (!gameRecord || !gameRecord.gameState) {
        throw new Error('Game not found');
    }

    if (gameRecord.status !== 'ACTIVE') {
        throw new Error('Game is not active');
    }

    const expectedLastUpdateAt = gameRecord.lastUpdateAt;
    const gameState = GalacticGameState.fromJSON(gameRecord.gameState);

    return { gameRecord, gameState, expectedLastUpdateAt };
}

/**
 * Save game state and notify via WebSocket
 */
export async function saveAndNotify(
    gameId: string,
    gameRecord: GameRecord,
    gameState: GalacticGameState,
    gameStorage: GameStorage,
    expectedLastUpdateAt: number
): Promise<void> {
    gameRecord.gameState = gameState.toJSON();
    await gameStorage.saveGame(gameRecord, expectedLastUpdateAt);
    await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);
}

/**
 * Simple retry logic for operations that may encounter version conflicts.
 * Uses a fixed delay between retries - no exponential backoff needed since
 * we're handling optimistic locking conflicts, not rate limiting.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: {
        maxAttempts?: number;
        operationName?: string;
    } = {}
): Promise<T> {
    const { maxAttempts = 4, operationName = 'operation' } = options;
    const RETRY_DELAY_MS = 100; // Fixed delay - simple and predictable

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                logger.info(`${operationName} succeeded on attempt ${attempt}`);
            }
            return result;
        } catch (error) {
            const isVersionConflict = error instanceof VersionConflictError;
            const hasMoreAttempts = attempt < maxAttempts;

            if (isVersionConflict && hasMoreAttempts) {
                logger.debug(`Version conflict on attempt ${attempt}/${maxAttempts} for ${operationName}, retrying in ${RETRY_DELAY_MS}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                continue;
            }

            // Either not a version conflict, or we've exhausted retries
            if (isVersionConflict) {
                logger.warn(`${operationName} failed after ${maxAttempts} attempts due to version conflicts`);
                throw new VersionConflictError(
                    (error as VersionConflictError).gameId,
                    (error as VersionConflictError).expectedVersion,
                    (error as VersionConflictError).actualVersion,
                    'Server busy - please try again'
                );
            }
            throw error;
        }
    }

    // TypeScript needs this but we should never reach here
    throw new Error(`${operationName} failed unexpectedly`);
}

/**
 * Start a pending game
 */
export async function startGame(
    gameId: string,
    gameStorage: GameStorage
): Promise<{ success: boolean; gameState?: any }> {
    try {
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord || gameRecord.status !== 'PENDING' || !gameRecord.pendingConfiguration) {
            return { success: false };
        }

        // Create game state from pending configuration
        const gameState = GalacticGameState.createInitialState(
            gameId,
            gameRecord.pendingConfiguration.playerSlots,
            gameRecord.pendingConfiguration.settings!,
            `seed-${gameId}`
        );

        // Update game record
        gameRecord.status = 'ACTIVE';
        gameRecord.gameState = gameState.toJSON();
        gameRecord.players = gameState.players;
        delete gameRecord.pendingConfiguration;

        await gameStorage.saveGame(gameRecord);

        // Notify all players via WebSocket
        await WebSocketNotifications.gameStarted(gameId, gameRecord.gameState);

        logger.info(`Game ${gameId} started with ${gameRecord.players.length} players`);

        return { success: true, gameState: gameRecord.gameState };
    } catch (error) {
        logger.error(`Failed to start game ${gameId}:`, error);
        return { success: false };
    }
}
