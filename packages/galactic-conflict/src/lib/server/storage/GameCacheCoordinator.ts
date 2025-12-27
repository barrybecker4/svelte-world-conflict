/**
 * GameCacheCoordinator - Centralizes all cache management operations
 * Handles open games cache and active games cache updates
 */

import type { GameRecord } from './types';
import type { KVStorage } from './KVStorage';
import {
    updateOpenGamesCache,
    removeFromOpenGamesCache,
} from './OpenGamesCache';
import {
    updateActiveGamesCache,
    removeFromActiveGamesCache,
} from './ActiveGamesCache';

export class GameCacheCoordinator {
    private storage: KVStorage;

    constructor(storage: KVStorage) {
        this.storage = storage;
    }

    /**
     * Handle cache updates when a game is saved
     * Updates open games cache and active games cache based on game status
     */
    async onGameSaved(game: GameRecord, previousStatus?: string): Promise<void> {
        const statusChanged = previousStatus !== undefined && previousStatus !== game.status;

        // Update open games cache
        if (game.status === 'PENDING') {
            await updateOpenGamesCache(game, this.storage);
        } else {
            // Remove from open games cache if not pending
            await removeFromOpenGamesCache(game.gameId, this.storage);
        }

        // Update active games cache
        if (game.status === 'ACTIVE') {
            await updateActiveGamesCache(game.gameId, this.storage);
        } else if (statusChanged && previousStatus === 'ACTIVE') {
            // Remove from active cache if transitioning away from ACTIVE
            await removeFromActiveGamesCache(game.gameId, this.storage);
        }
    }

    /**
     * Handle cache cleanup when a game is deleted
     */
    async onGameDeleted(gameId: string): Promise<void> {
        await removeFromOpenGamesCache(gameId, this.storage);
        await removeFromActiveGamesCache(gameId, this.storage);
    }
}

