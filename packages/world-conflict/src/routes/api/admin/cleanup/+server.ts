import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cleanupOldGames, getGameStats } from '$lib/server/storage/GameCleanup';
import { logger } from 'multiplayer-framework/shared';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET: Get statistics about game entries
 */
export const GET: RequestHandler = async ({ platform }) => {
    try {
        const stats = await getGameStats(platform!);
        return json(stats);
    } catch (error) {
        logger.error('Error getting game stats:', error);
        return json({ error: 'Failed to get game stats' }, { status: 500 });
    }
};

/**
 * POST: Clean up old game entries
 * 
 * Query params:
 * - maxAgeDays: Maximum age in days (default: 1)
 * - dryRun: If "true", only report what would be deleted (default: false)
 */
export const POST: RequestHandler = async ({ url, platform }) => {
    try {
        const maxAgeDays = parseFloat(url.searchParams.get('maxAgeDays') || '1');
        const dryRun = url.searchParams.get('dryRun') === 'true';
        
        if (isNaN(maxAgeDays) || maxAgeDays <= 0) {
            return json({ error: 'Invalid maxAgeDays parameter' }, { status: 400 });
        }

        const maxAgeMs = maxAgeDays * ONE_DAY_MS;
        
        logger.info(`Starting cleanup: maxAgeDays=${maxAgeDays}, dryRun=${dryRun}`);
        
        const result = await cleanupOldGames(platform!, maxAgeMs, dryRun);
        
        return json({
            success: true,
            dryRun,
            maxAgeDays,
            ...result
        });
    } catch (error) {
        logger.error('Error during cleanup:', error);
        return json({ error: 'Cleanup failed' }, { status: 500 });
    }
};

