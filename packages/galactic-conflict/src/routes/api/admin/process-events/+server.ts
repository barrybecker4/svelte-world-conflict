/**
 * Manual event processing endpoint for local development
 * In production, events are processed automatically via cron triggers
 * This endpoint allows manual triggering for local testing
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processAllGameEvents } from '$lib/server/processAllGameEvents';
import { logger } from 'multiplayer-framework/shared';

export const POST: RequestHandler = async ({ platform }) => {
    if (!platform) {
        return json({ error: 'Platform not available' }, { status: 500 });
    }

    try {
        const result = await processAllGameEvents(platform);
        
        return json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('[Manual] Error processing events:', error);
        return json({ 
            error: 'Failed to process events',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

