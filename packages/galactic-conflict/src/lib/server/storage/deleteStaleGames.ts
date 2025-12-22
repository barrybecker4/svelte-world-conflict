/**
 * Utility functions for deleting stale games
 */

import type { GameStorage } from './GameStorage';
import { logger } from 'multiplayer-framework/shared';

/**
 * Delete stale games from storage
 * @param staleGameIds - Array of game IDs to delete
 * @param gameStorage - GameStorage instance to use for deletion
 */
export async function deleteStaleGames(
    staleGameIds: string[],
    gameStorage: GameStorage
): Promise<void> {
    if (staleGameIds.length === 0) {
        return;
    }

    logger.info(`Removing ${staleGameIds.length} stale game(s) from storage`);
    for (const gameId of staleGameIds) {
        try {
            await gameStorage.deleteGame(gameId);
        } catch (error) {
            logger.error(`Failed to delete stale game ${gameId}:`, error);
        }
    }
}

