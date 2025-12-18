/**
 * SvelteKit server hooks
 * Handles scheduled events (cron triggers) for processing game events
 */

import type { ScheduledEvent } from '@cloudflare/workers-types';
import { processAllGameEvents } from '$lib/server/processAllGameEvents';
import { logger } from 'multiplayer-framework/shared';

/**
 * Handle scheduled events (cron triggers)
 * Called automatically by Cloudflare when cron trigger fires
 */
export async function scheduled(
    event: ScheduledEvent,
    env: any,
    ctx: ExecutionContext
): Promise<void> {
    logger.info('[Scheduled] Cron trigger fired', { cron: event.cron, scheduledTime: event.scheduledTime });
    
    // Create platform object from Cloudflare Workers env
    // The adapter-cloudflare provides env with KV bindings
    const platform = {
        env: {
            GALACTIC_CONFLICT_KV: env.GALACTIC_CONFLICT_KV
        }
    } as App.Platform;

    if (!platform.env.GALACTIC_CONFLICT_KV) {
        logger.error('[Scheduled] GALACTIC_CONFLICT_KV not available in env');
        return;
    }

    // Use shared function to process all games
    await processAllGameEvents(platform);
}

