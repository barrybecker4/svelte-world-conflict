/**
 * Active Games Cache - Manages cached list of active game IDs for efficient retrieval
 * Reduces KV list operations by maintaining a single cached list of active games
 */

import type { KVStorage } from './KVStorage';
import { logger } from 'multiplayer-framework/shared';

export const ACTIVE_GAMES_KEY = 'gc_active_games';

export interface ActiveGamesList {
    gameIds: string[];
    lastUpdated: number;
}

/**
 * Update the cached active games list when a game becomes active
 */
export async function updateActiveGamesCache(
    gameId: string,
    storage: KVStorage
): Promise<void> {
    try {
        const currentList = await storage.get<ActiveGamesList>(ACTIVE_GAMES_KEY) || {
            gameIds: [],
            lastUpdated: Date.now()
        };
        
        // Add game ID if not already in the list
        if (!currentList.gameIds.includes(gameId)) {
            currentList.gameIds.push(gameId);
            currentList.lastUpdated = Date.now();
            await storage.put(ACTIVE_GAMES_KEY, currentList);
            logger.debug(`Added game ${gameId} to active games cache (total: ${currentList.gameIds.length})`);
        }
    } catch (error) {
        logger.warn(`Error updating active games cache for game ${gameId}:`, error);
    }
}

/**
 * Remove a game from the cached active games list
 */
export async function removeFromActiveGamesCache(
    gameId: string,
    storage: KVStorage
): Promise<void> {
    try {
        const currentList = await storage.get<ActiveGamesList>(ACTIVE_GAMES_KEY);
        if (!currentList) return;
        
        const originalLength = currentList.gameIds.length;
        currentList.gameIds = currentList.gameIds.filter(id => id !== gameId);
        
        if (currentList.gameIds.length !== originalLength) {
            currentList.lastUpdated = Date.now();
            await storage.put(ACTIVE_GAMES_KEY, currentList);
            logger.debug(`Removed game ${gameId} from active games cache (remaining: ${currentList.gameIds.length})`);
        }
    } catch (error) {
        logger.warn(`Error removing game ${gameId} from active games cache:`, error);
    }
}

/**
 * Get the cached active games list
 */
export async function getActiveGamesCache(
    storage: KVStorage
): Promise<ActiveGamesList | null> {
    return await storage.get<ActiveGamesList>(ACTIVE_GAMES_KEY);
}

/**
 * Save the active games cache from a full scan
 */
export async function saveActiveGamesCache(
    gameIds: string[],
    storage: KVStorage
): Promise<void> {
    await storage.put(ACTIVE_GAMES_KEY, {
        gameIds,
        lastUpdated: Date.now()
    });
    logger.info(`Rebuilt active games cache with ${gameIds.length} active games`);
}

/**
 * Rebuild the active games cache by performing a full KV scan
 * This should only be called when the cache is missing or suspected to be out of sync
 */
export async function rebuildActiveGamesCache(
    storage: KVStorage,
    gameKeyPrefix: string
): Promise<ActiveGamesList> {
    logger.info('Rebuilding active games cache from full KV scan');
    
    const result = await storage.list(gameKeyPrefix);
    const activeGameIds: string[] = [];
    
    for (const key of result.keys) {
        const game = await storage.get<{ gameId: string; status: string }>(key.name);
        if (game && game.status === 'ACTIVE') {
            activeGameIds.push(game.gameId);
        }
    }
    
    await saveActiveGamesCache(activeGameIds, storage);
    
    return {
        gameIds: activeGameIds,
        lastUpdated: Date.now()
    };
}
