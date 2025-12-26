/**
 * Service for tracking and retrieving daily game statistics
 */
import { KVStorage } from './KVStorage';
import type { DailyGameStats, StatsError, GameRecord } from './types';
import { logger } from 'multiplayer-framework/shared';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';

const STATS_KEY_PREFIX = 'wc_stats:';

/**
 * Create an empty DailyGameStats object for a given date
 */
function createEmptyStats(date: string): DailyGameStats {
    return {
        date,
        completedGames: 0,
        incompleteGames: 0,
        gamesStarted: 0,
        gamesWithMultipleHumans: 0,
        totalHumanPlayers: 0,
        totalAiPlayers: 0,
        uniquePlayerNames: [],
        totalTurns: 0,
        minTurns: Infinity,
        maxTurns: 0,
        endReasons: {
            elimination: 0,
            turnLimit: 0,
            resignation: 0
        },
        winners: {
            human: 0,
            ai: 0,
            drawn: 0
        },
        errors: []
    };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateKey(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get a date key N days ago
 */
function getDateKeyNDaysAgo(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

/**
 * Update player counts in stats
 */
function updatePlayerCounts(stats: DailyGameStats, game: GameRecord): void {
    const humanPlayers = game.players.filter(p => !p.isAI);
    const aiPlayers = game.players.filter(p => p.isAI);

    stats.totalHumanPlayers += humanPlayers.length;
    stats.totalAiPlayers += aiPlayers.length;

    if (humanPlayers.length >= 2) {
        stats.gamesWithMultipleHumans++;
    }

    // Add unique player names (using Set for deduplication)
    const namesSet = new Set(stats.uniquePlayerNames);
    for (const player of humanPlayers) {
        namesSet.add(player.name);
    }
    stats.uniquePlayerNames = Array.from(namesSet);
}

/**
 * Update turn statistics in stats
 */
function updateTurnStats(stats: DailyGameStats, turnNumber: number): void {
    stats.totalTurns += turnNumber;
    stats.minTurns = Math.min(stats.minTurns === Infinity ? turnNumber : stats.minTurns, turnNumber);
    stats.maxTurns = Math.max(stats.maxTurns, turnNumber);
}

/**
 * Update end reason counts in stats
 */
function updateEndReason(stats: DailyGameStats, reason: 'ELIMINATION' | 'TURN_LIMIT' | 'RESIGNATION' | null): void {
    if (!reason) return;

    switch (reason) {
        case 'ELIMINATION':
            stats.endReasons.elimination++;
            break;
        case 'TURN_LIMIT':
            stats.endReasons.turnLimit++;
            break;
        case 'RESIGNATION':
            stats.endReasons.resignation++;
            break;
    }
}

/**
 * Update winner counts in stats based on game end result
 */
function updateWinnerStats(stats: DailyGameStats, endResult: unknown): void {
    if (endResult === 'DRAWN_GAME') {
        stats.winners.drawn++;
    } else if (endResult && typeof endResult === 'object' && 'isAI' in endResult) {
        // endResult is a Player object
        if ((endResult as { isAI: boolean }).isAI) {
            stats.winners.ai++;
        } else {
            stats.winners.human++;
        }
    }
}

/**
 * Service for tracking daily game statistics
 */
export class GameStatsService {
    private kv: KVStorage;

    constructor(platform: App.Platform) {
        this.kv = new KVStorage(platform);
    }

    /**
     * Create a GameStatsService instance
     */
    static create(platform: App.Platform): GameStatsService {
        return new GameStatsService(platform);
    }

    /**
     * Get the KV key for a specific date
     */
    private getStatsKey(date: string): string {
        return `${STATS_KEY_PREFIX}${date}`;
    }

    /**
     * Get or create stats for a specific date
     */
    private async getOrCreateStats(date: string): Promise<DailyGameStats> {
        const key = this.getStatsKey(date);
        const existing = await this.kv.get<DailyGameStats>(key);

        if (existing) {
            // Handle legacy data where minTurns might be Infinity (stored as null in JSON)
            if (existing.minTurns === null || existing.minTurns === undefined) {
                existing.minTurns = Infinity;
            }
            return existing;
        }

        return createEmptyStats(date);
    }

    /**
     * Save stats for a specific date
     */
    private async saveStats(stats: DailyGameStats): Promise<void> {
        const key = this.getStatsKey(stats.date);
        // JSON doesn't support Infinity, so we need to handle it
        const toSave = {
            ...stats,
            minTurns: stats.minTurns === Infinity ? null : stats.minTurns
        };
        await this.kv.put(key, toSave);
    }

    /**
     * Record when a game is completed
     */
    async recordGameCompleted(game: GameRecord): Promise<void> {
        try {
            const date = getTodayDateKey();
            logger.info(`Recording game completion for ${game.gameId} on ${date}`);

            const stats = await this.getOrCreateStats(date);

            stats.completedGames++;
            logger.debug(`completedGames now: ${stats.completedGames}`);

            updatePlayerCounts(stats, game);
            updateTurnStats(stats, game.worldConflictState.turnNumber);

            // Determine end reason by checking game state
            const endCheck = checkGameEnd(game.worldConflictState, game.players);
            updateEndReason(stats, endCheck.reason);

            // Use the stored endResult for winner tracking
            updateWinnerStats(stats, game.worldConflictState.endResult);

            await this.saveStats(stats);
            logger.debug(`Recorded game completion stats for ${date}`);
        } catch (error) {
            logger.error('Error recording game completion stats:', error);
        }
    }

    /**
     * Record when a game is started
     */
    async recordGameStarted(): Promise<void> {
        try {
            const date = getTodayDateKey();
            const stats = await this.getOrCreateStats(date);
            stats.gamesStarted++;
            await this.saveStats(stats);
            logger.debug(`Recorded game started for ${date}`);
        } catch (error) {
            logger.error('Error recording game started stats:', error);
        }
    }

    /**
     * Record when a game is abandoned/quit
     */
    async recordGameAbandoned(gameId: string): Promise<void> {
        try {
            const date = getTodayDateKey();
            const stats = await this.getOrCreateStats(date);
            stats.incompleteGames++;
            await this.saveStats(stats);
            logger.debug(`Recorded game abandoned for ${date}: ${gameId}`);
        } catch (error) {
            logger.error('Error recording game abandoned stats:', error);
        }
    }

    /**
     * Record an error that occurred
     */
    async recordError(error: Error, gameId?: string): Promise<void> {
        try {
            const date = getTodayDateKey();
            const stats = await this.getOrCreateStats(date);

            const statsError: StatsError = {
                timestamp: Date.now(),
                type: error.name || 'Error',
                message: error.message || String(error),
                gameId
            };

            stats.errors.push(statsError);
            await this.saveStats(stats);
            logger.debug(`Recorded error for ${date}`);
        } catch (recordError) {
            // Don't let error recording cause more errors
            logger.error('Error recording error stats:', recordError);
        }
    }

    /**
     * Get stats for a specific date
     */
    async getDailyStats(date: string): Promise<DailyGameStats | null> {
        try {
            const key = this.getStatsKey(date);
            const stats = await this.kv.get<DailyGameStats>(key);

            if (stats) {
                // Handle legacy data where minTurns might be null
                if (stats.minTurns === null || stats.minTurns === undefined) {
                    stats.minTurns = Infinity;
                }
            }

            return stats;
        } catch (error) {
            logger.error(`Error getting daily stats for ${date}:`, error);
            return null;
        }
    }

    /**
     * Get stats for the last N days (including today)
     * Returns an array ordered from oldest to newest
     */
    async getStatsForLastNDays(n: number): Promise<DailyGameStats[]> {
        try {
            const results: DailyGameStats[] = [];

            // Fetch stats for each day (from oldest to newest)
            for (let i = n - 1; i >= 0; i--) {
                const dateKey = getDateKeyNDaysAgo(i);
                const stats = await this.getDailyStats(dateKey);

                if (stats) {
                    results.push(stats);
                } else {
                    // Include empty stats for days with no data
                    results.push(createEmptyStats(dateKey));
                }
            }

            return results;
        } catch (error) {
            logger.error(`Error getting stats for last ${n} days:`, error);
            return [];
        }
    }
}
