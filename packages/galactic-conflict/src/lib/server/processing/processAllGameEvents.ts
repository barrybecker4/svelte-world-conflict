/**
 * Shared function to process events for all active games
 */

import { GameStorage } from '../storage/GameStorage';
import { processGameEvents } from './EventProcessor';
import { logger } from 'multiplayer-framework/shared';

export interface ProcessAllGamesResult {
    gamesProcessed: number;
    eventsProcessed: number;
    errors: number;
}

/**
 * Process events for all active games
 * @param platform - App.Platform with KV bindings
 * @returns Result with counts of games processed, events processed, and errors
 */
export async function processAllGameEvents(
    platform: App.Platform
): Promise<ProcessAllGamesResult> {
    const startTime = Date.now();
    let gamesProcessed = 0;
    let eventsProcessed = 0;
    let errors = 0;

    try {
        const gameStorage = GameStorage.create(platform);
        
        // Get all active games
        const activeGames = await gameStorage.listGames('ACTIVE');
        
        // Log game IDs for debugging
        const gameIds = activeGames.map(g => g.gameId).join(', ');
        logger.info(`[EventProcessing] Processing events for ${activeGames.length} active games: ${gameIds}`);

        // Process events for each game in parallel
        const results = await Promise.allSettled(
            activeGames.map(async (game) => {
                try {
                    const hadEvents = await processGameEvents(game.gameId, gameStorage, platform);
                    gamesProcessed++;
                    if (hadEvents) {
                        eventsProcessed++;
                    }
                    return { success: true, gameId: game.gameId };
                } catch (error) {
                    errors++;
                    logger.error(`[EventProcessing] Error processing game ${game.gameId}:`, error);
                    throw error;
                }
            })
        );

        // Log any rejected promises
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`[EventProcessing] Game ${activeGames[index].gameId} processing failed:`, result.reason);
            }
        });

        const duration = Date.now() - startTime;
        logger.info(`[EventProcessing] Complete: ${gamesProcessed} games processed, ${eventsProcessed} had events, ${errors} errors, ${duration}ms`);

        return { gamesProcessed, eventsProcessed, errors };
    } catch (error) {
        logger.error('[EventProcessing] Fatal error:', error);
        return { gamesProcessed, eventsProcessed, errors };
    }
}

