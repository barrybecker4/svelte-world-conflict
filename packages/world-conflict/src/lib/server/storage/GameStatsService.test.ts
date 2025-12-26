/**
 * Unit tests for GameStatsService
 * Tests daily statistics tracking functionality
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { GameStatsService } from './GameStatsService';
import type { GameRecord, DailyGameStats } from './types';
import type { Player, GameStateData } from '$lib/game/state/GameState';

// Mock KVStorage
const mockKVData = new Map<string, any>();

vi.mock('./KVStorage', () => ({
    KVStorage: vi.fn().mockImplementation(() => ({
        get: vi.fn(async (key: string) => mockKVData.get(key) || null),
        put: vi.fn(async (key: string, value: any) => {
            mockKVData.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            mockKVData.delete(key);
        }),
        list: vi.fn(async () => ({ keys: [] }))
    }))
}));

// Mock logger
vi.mock('$lib/game/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Mock platform
const mockPlatform = {
    env: {
        WORLD_CONFLICT_KV: {
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            list: vi.fn()
        }
    }
} as unknown as App.Platform;

/**
 * Create a mock player
 */
function createMockPlayer(options: { slotIndex: number; name: string; isAI: boolean }): Player {
    return {
        slotIndex: options.slotIndex,
        name: options.name,
        isAI: options.isAI,
        color: '#ff0000'
    };
}

/**
 * Create a mock GameRecord for testing
 */
function createMockGameRecord(options: {
    gameId?: string;
    players?: Player[];
    turnNumber?: number;
    endResult?: Player | 'DRAWN_GAME' | null;
    status?: 'PENDING' | 'ACTIVE' | 'COMPLETED';
}): GameRecord {
    const players = options.players || [
        createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false }),
        createMockPlayer({ slotIndex: 1, name: 'AI Bot', isAI: true })
    ];

    const worldConflictState: GameStateData = {
        id: 1,
        gameId: options.gameId || 'test-game-1',
        turnNumber: options.turnNumber ?? 5,
        currentPlayerSlot: 0,
        movesRemaining: 3,
        ownersByRegion: { 0: 0, 1: 1 },
        templesByRegion: {},
        soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
        faithByPlayer: { 0: 10, 1: 10 },
        players,
        regions: [],
        endResult: options.endResult ?? null,
        maxTurns: 10
    };

    return {
        gameId: options.gameId || 'test-game-1',
        status: options.status || 'COMPLETED',
        players,
        worldConflictState,
        createdAt: Date.now(),
        lastMoveAt: Date.now(),
        currentPlayerSlot: 0,
        gameType: 'MULTIPLAYER'
    };
}

describe('GameStatsService', () => {
    let statsService: GameStatsService;

    beforeEach(() => {
        // Clear mock KV data before each test
        mockKVData.clear();
        statsService = GameStatsService.create(mockPlatform);
    });

    describe('recordGameStarted', () => {
        it('should increment gamesStarted counter', async () => {
            await statsService.recordGameStarted();

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats).not.toBeNull();
            expect(stats!.gamesStarted).toBe(1);
        });

        it('should increment gamesStarted for multiple games', async () => {
            await statsService.recordGameStarted();
            await statsService.recordGameStarted();
            await statsService.recordGameStarted();

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.gamesStarted).toBe(3);
        });
    });

    describe('recordGameCompleted', () => {
        it('should increment completedGames counter', async () => {
            const game = createMockGameRecord({
                players: [
                    createMockPlayer({
                        slotIndex: 0,
                        name: 'Winner',
                        isAI: false
                    })
                ],
                endResult: createMockPlayer({
                    slotIndex: 0,
                    name: 'Winner',
                    isAI: false
                })
            });

            await statsService.recordGameCompleted(game);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats).not.toBeNull();
            expect(stats!.completedGames).toBe(1);
        });

        it('should count human and AI players correctly', async () => {
            const game = createMockGameRecord({
                players: [
                    createMockPlayer({
                        slotIndex: 0,
                        name: 'Human1',
                        isAI: false
                    }),
                    createMockPlayer({
                        slotIndex: 1,
                        name: 'Human2',
                        isAI: false
                    }),
                    createMockPlayer({
                        slotIndex: 2,
                        name: 'AI Bot',
                        isAI: true
                    })
                ]
            });

            await statsService.recordGameCompleted(game);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.totalHumanPlayers).toBe(2);
            expect(stats!.totalAiPlayers).toBe(1);
            expect(stats!.gamesWithMultipleHumans).toBe(1);
        });

        it('should track unique player names', async () => {
            const game1 = createMockGameRecord({
                gameId: 'game-1',
                players: [
                    createMockPlayer({
                        slotIndex: 0,
                        name: 'Alice',
                        isAI: false
                    }),
                    createMockPlayer({
                        slotIndex: 1,
                        name: 'AI Bot',
                        isAI: true
                    })
                ]
            });

            const game2 = createMockGameRecord({
                gameId: 'game-2',
                players: [
                    createMockPlayer({
                        slotIndex: 0,
                        name: 'Alice',
                        isAI: false
                    }),
                    createMockPlayer({
                        slotIndex: 1,
                        name: 'Bob',
                        isAI: false
                    })
                ]
            });

            await statsService.recordGameCompleted(game1);
            await statsService.recordGameCompleted(game2);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.uniquePlayerNames).toContain('Alice');
            expect(stats!.uniquePlayerNames).toContain('Bob');
            expect(stats!.uniquePlayerNames).toHaveLength(2); // Alice should not be duplicated
        });

        it('should track turn statistics', async () => {
            const game1 = createMockGameRecord({ turnNumber: 5 });
            const game2 = createMockGameRecord({ turnNumber: 15 });
            const game3 = createMockGameRecord({ turnNumber: 10 });

            await statsService.recordGameCompleted(game1);
            await statsService.recordGameCompleted(game2);
            await statsService.recordGameCompleted(game3);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.totalTurns).toBe(30); // 5 + 15 + 10
            expect(stats!.minTurns).toBe(5);
            expect(stats!.maxTurns).toBe(15);
        });

        it('should track human winner', async () => {
            const humanPlayer = createMockPlayer({
                slotIndex: 0,
                name: 'Human',
                isAI: false
            });
            const game = createMockGameRecord({
                players: [humanPlayer, createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true })],
                endResult: humanPlayer
            });

            await statsService.recordGameCompleted(game);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.winners.human).toBe(1);
            expect(stats!.winners.ai).toBe(0);
            expect(stats!.winners.drawn).toBe(0);
        });

        it('should track AI winner', async () => {
            const aiPlayer = createMockPlayer({
                slotIndex: 1,
                name: 'AI Bot',
                isAI: true
            });
            const game = createMockGameRecord({
                players: [
                    createMockPlayer({
                        slotIndex: 0,
                        name: 'Human',
                        isAI: false
                    }),
                    aiPlayer
                ],
                endResult: aiPlayer
            });

            await statsService.recordGameCompleted(game);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.winners.ai).toBe(1);
            expect(stats!.winners.human).toBe(0);
        });

        it('should track drawn games', async () => {
            const game = createMockGameRecord({
                endResult: 'DRAWN_GAME'
            });

            await statsService.recordGameCompleted(game);

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.winners.drawn).toBe(1);
        });
    });

    describe('recordGameAbandoned', () => {
        it('should increment incompleteGames counter', async () => {
            await statsService.recordGameAbandoned('test-game-1');

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.incompleteGames).toBe(1);
        });
    });

    describe('recordError', () => {
        it('should record errors with details', async () => {
            const error = new Error('Test error message');
            error.name = 'TestError';

            await statsService.recordError(error, 'test-game-1');

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats!.errors).toHaveLength(1);
            expect(stats!.errors[0].type).toBe('TestError');
            expect(stats!.errors[0].message).toBe('Test error message');
            expect(stats!.errors[0].gameId).toBe('test-game-1');
        });
    });

    describe('getStatsForLastNDays', () => {
        it('should return stats for last N days', async () => {
            // Record stats for today
            await statsService.recordGameStarted();
            await statsService.recordGameStarted();

            const stats = await statsService.getStatsForLastNDays(7);

            expect(stats).toHaveLength(7);
            // The last entry should be today with 2 games started
            expect(stats[stats.length - 1].gamesStarted).toBe(2);
        });

        it('should return empty stats for days with no data', async () => {
            const stats = await statsService.getStatsForLastNDays(3);

            expect(stats).toHaveLength(3);
            stats.forEach(dayStat => {
                expect(dayStat.completedGames).toBe(0);
                expect(dayStat.gamesStarted).toBe(0);
            });
        });
    });

    describe('getDailyStats', () => {
        it('should return null for dates with no stats', async () => {
            const stats = await statsService.getDailyStats('1999-01-01');
            expect(stats).toBeNull();
        });

        it('should return stats for dates with data', async () => {
            await statsService.recordGameStarted();

            const todayKey = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(todayKey);

            expect(stats).not.toBeNull();
            expect(stats!.date).toBe(todayKey);
        });
    });
});
