/**
 * Service for tracking and retrieving daily game statistics
 */
import { KVStorage } from './KVStorage';
import type { DailyGameStats, StatsError, GameRecord } from './types';
import { logger } from 'multiplayer-framework/shared';
import { normalizeStats, prepareStatsForStorage } from './statsHelpers';

const STATS_KEY_PREFIX = 'gc_stats:';

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
        totalDurationMinutes: 0,
        minDurationMinutes: Infinity,
        maxDurationMinutes: 0,
        endReasons: {
            elimination: 0,
            timeLimit: 0,
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
 * Update duration statistics in stats (in minutes)
 */
function updateDurationStats(stats: DailyGameStats, durationMinutes: number): void {
    stats.totalDurationMinutes += durationMinutes;
    stats.minDurationMinutes = Math.min(stats.minDurationMinutes === Infinity ? durationMinutes : stats.minDurationMinutes, durationMinutes);
    stats.maxDurationMinutes = Math.max(stats.maxDurationMinutes, durationMinutes);
}

/**
 * Determine end reason for galactic-conflict game
 */
function determineEndReason(game: GameRecord): 'ELIMINATION' | 'TIME_LIMIT' | 'RESIGNATION' | null {
    if (!game.gameState) {
        return null;
    }

    const gameState = game.gameState;
    const now = Date.now();
    const startTime = gameState.startTime;
    const durationMinutes = gameState.durationMinutes;
    const expectedEndTime = startTime + durationMinutes * 60 * 1000;
    
    // Check if game ended due to time limit (within 5 seconds of expected end time)
    const timeDiff = Math.abs(now - expectedEndTime);
    if (timeDiff < 5000 && gameState.endResult !== null && gameState.endResult !== undefined) {
        // Check if there are multiple active players (time limit scenario)
        const activePlayers = gameState.players.filter(p => !gameState.eliminatedPlayers.includes(p.slotIndex));
        if (activePlayers.length > 1) {
            return 'TIME_LIMIT';
        }
    }

    // Check if game ended with only one player remaining (elimination)
    const activePlayers = gameState.players.filter(p => !gameState.eliminatedPlayers.includes(p.slotIndex));
    if (activePlayers.length === 1 && gameState.endResult && gameState.endResult !== 'DRAWN_GAME') {
        // If there was a resignation event recently, it might be resignation
        // For now, we'll infer resignation if the game ended quickly after start
        const actualDuration = (now - startTime) / (60 * 1000); // minutes
        if (actualDuration < durationMinutes * 0.1) {
            // Game ended in less than 10% of expected duration - likely resignation
            return 'RESIGNATION';
        }
        return 'ELIMINATION';
    }

    // If endResult is DRAWN_GAME and time expired, it's time limit
    if (gameState.endResult === 'DRAWN_GAME' && timeDiff < 5000) {
        return 'TIME_LIMIT';
    }

    // Default to elimination if we have a winner
    if (gameState.endResult && gameState.endResult !== 'DRAWN_GAME') {
        return 'ELIMINATION';
    }

    return null;
}

/**
 * Update end reason counts in stats
 */
function updateEndReason(stats: DailyGameStats, reason: 'ELIMINATION' | 'TIME_LIMIT' | 'RESIGNATION' | null): void {
    if (!reason) return;
    
    switch (reason) {
        case 'ELIMINATION':
            stats.endReasons.elimination++;
            break;
        case 'TIME_LIMIT':
            stats.endReasons.timeLimit++;
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
            return normalizeStats(existing);
        }

        return createEmptyStats(date);
    }

    /**
     * Save stats for a specific date
     */
    private async saveStats(stats: DailyGameStats): Promise<void> {
        const key = this.getStatsKey(stats.date);
        const toSave = prepareStatsForStorage(stats);
        await this.kv.put(key, toSave);
    }

    /**
     * Record when a game is completed
     */
    async recordGameCompleted(game: GameRecord): Promise<void> {
        try {
            const date = getTodayDateKey();
            logger.info(`Recording game completion for ${game.gameId} on ${date}`);
            
            if (!game.gameState) {
                logger.warn(`Game ${game.gameId} has no gameState, skipping stats recording`);
                return;
            }

            const stats = await this.getOrCreateStats(date);

            stats.completedGames++;
            logger.debug(`completedGames now: ${stats.completedGames}`);

            updatePlayerCounts(stats, game);
            
            // Calculate actual game duration in minutes
            const gameState = game.gameState;
            const startTime = gameState.startTime;
            const now = Date.now();
            const actualDurationMinutes = (now - startTime) / (60 * 1000);
            updateDurationStats(stats, actualDurationMinutes);
            
            // Determine end reason
            const endReason = determineEndReason(game);
            updateEndReason(stats, endReason);
            
            // Use the stored endResult for winner tracking
            updateWinnerStats(stats, gameState.endResult);

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
                return normalizeStats(stats);
            }

            return null;
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

