import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStatsService } from '$lib/server/storage/GameStatsService';
import { logger } from 'multiplayer-framework/shared';
import { VERSION } from '$lib/version';

// Stats fix version - increment this when making stats-related fixes
const STATS_FIX_VERSION = '2025-01-01-v1';

/**
 * GET: Get daily stats for today or a specific date
 * Query params:
 * - date: YYYY-MM-DD format (default: today)
 * - days: Get stats for last N days (default: 1)
 */
export const GET: RequestHandler = async ({ url, platform }) => {
    try {
        if (!platform) {
            logger.warn('Platform not available for stats endpoint');
            return json({ error: 'Platform not available', stats: [] }, { status: 503 });
        }

        const statsService = GameStatsService.create(platform);
        
        const days = parseInt(url.searchParams.get('days') || '1');
        
        if (days > 1) {
            const stats = await statsService.getStatsForLastNDays(days);
            return json({ stats: stats || [] });
        }
        
        const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const stats = await statsService.getDailyStats(date);
        
        return json({
            version: VERSION,
            statsFixVersion: STATS_FIX_VERSION,
            ...(stats || { error: 'No stats found for this date', date })
        });
    } catch (error) {
        logger.error('Error getting stats:', error);
        return json({ error: 'Failed to get stats', stats: [] }, { status: 500 });
    }
};
