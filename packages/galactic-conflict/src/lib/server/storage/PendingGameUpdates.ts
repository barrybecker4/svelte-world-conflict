import type { GameRecord } from './GameStorage';
import type { GameStorage } from './GameStorage';
import { logger } from 'multiplayer-framework/shared';

/**
 * In-memory cache for pending game updates (server-side KV write batching)
 * This allows multiple actions to be processed in memory and flushed to KV when needed
 */

// Track pending game updates per game ID (in-memory batching)
const pendingUpdates = new Map<string, GameRecord>();

/**
 * Get pending update for a game, if any
 */
export function getPendingUpdate(gameId: string): GameRecord | undefined {
    return pendingUpdates.get(gameId);
}

/**
 * Set pending update for a game (defers KV write)
 */
export function setPendingUpdate(gameId: string, game: GameRecord): void {
    pendingUpdates.set(gameId, game);
    logger.debug(`Stored pending update for game ${gameId}`);
}

/**
 * Clear pending update for a game
 */
export function clearPendingUpdate(gameId: string): void {
    pendingUpdates.delete(gameId);
}

/**
 * Flush pending update for a game to KV storage
 * Called when we need to persist the game state
 */
export async function flushPendingUpdate(gameId: string, gameStorage: GameStorage): Promise<void> {
    const pendingUpdate = pendingUpdates.get(gameId);
    if (pendingUpdate) {
        await gameStorage.saveGame(pendingUpdate);
        pendingUpdates.delete(gameId);
        logger.debug(`Flushed pending update for game ${gameId}`);
    }
}

