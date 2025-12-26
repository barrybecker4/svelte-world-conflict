/**
 * Admin endpoint to rebuild the active games cache
 * Useful for debugging or if the cache gets out of sync
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { rebuildActiveGamesCache } from '$lib/server/storage/ActiveGamesCache';
import { KVStorage } from '$lib/server/storage/KVStorage';
import { logger } from 'multiplayer-framework/shared';

const GAME_KEY_PREFIX = 'gc_game:';

export const POST: RequestHandler = async ({ platform }) => {
    if (!platform) {
        return json({ error: 'Platform not available' }, { status: 500 });
    }

    try {
        const storage = new KVStorage(platform);
        const result = await rebuildActiveGamesCache(storage, GAME_KEY_PREFIX);
        
        logger.info(`Cache rebuilt with ${result.gameIds.length} active games: ${result.gameIds.join(', ')}`);
        
        return json({
            success: true,
            activeGameCount: result.gameIds.length,
            activeGameIds: result.gameIds,
            lastUpdated: result.lastUpdated
        });
    } catch (error) {
        logger.error('[Admin] Error rebuilding cache:', error);
        return json({ 
            error: 'Failed to rebuild cache',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
