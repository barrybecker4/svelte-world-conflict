/**
 * GameStatusHandler - Manages status transitions and their side effects
 * Handles statistics recording when games transition to COMPLETED
 */

import type { GameRecord } from './types';
import type { GameCacheCoordinator } from './GameCacheCoordinator';
import type { GameStatsService } from './GameStatsService';
import { logger } from 'multiplayer-framework/shared';

export class GameStatusHandler {
    private cacheCoordinator: GameCacheCoordinator;
    private statsService: GameStatsService | null;

    constructor(
        cacheCoordinator: GameCacheCoordinator,
        statsService: GameStatsService | null
    ) {
        this.cacheCoordinator = cacheCoordinator;
        this.statsService = statsService;
    }

    /**
     * Handle status change side effects
     * Triggers cache updates and statistics recording as needed
     */
    async handleStatusChange(
        game: GameRecord,
        previousStatus?: string
    ): Promise<void> {
        const statusChanged = previousStatus !== undefined && previousStatus !== game.status;

        // Record game completion statistics
        if (game.status === 'COMPLETED' && statusChanged) {
            logger.info(`Game ${game.gameId} completed - recording stats. endResult: ${JSON.stringify(game.gameState?.endResult)}`);
            if (this.statsService) {
                await this.statsService.recordGameCompleted(game);
            } else {
                logger.warn(`No stats service available for game ${game.gameId}`);
            }
        }
    }
}

