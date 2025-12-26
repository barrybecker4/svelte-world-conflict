/**
 * Unit tests for ScoreCalculator
 * Tests player score calculation based on regions, soldiers, and faith
 */

import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from './ScoreCalculator';
import type { GameStateData } from '$lib/game/entities/gameTypes';

// Helper to create minimal game state data for testing
function createGameStateData(options: {
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, { i: number }[]>;
    faithByPlayer?: Record<number, number>;
}): GameStateData {
    return {
        id: 1,
        gameId: 'test-game',
        turnNumber: 1,
        currentPlayerSlot: 0,
        players: [
            { slotIndex: 0, name: 'Player 1', color: '#ff0000', isAI: false },
            { slotIndex: 1, name: 'Player 2', color: '#0000ff', isAI: false }
        ],
        regions: [],
        movesRemaining: 3,
        maxTurns: 100,
        ownersByRegion: options.ownersByRegion || {},
        soldiersByRegion: options.soldiersByRegion || {},
        templesByRegion: {},
        faithByPlayer: options.faithByPlayer ?? { 0: 0, 1: 0 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: 'test-seed'
    };
}

describe('ScoreCalculator', () => {
    describe('calculatePlayerScore', () => {
        it('should return 0 for player with no regions, no soldiers, and no faith', () => {
            const gameState = createGameStateData({
                ownersByRegion: {},
                soldiersByRegion: {},
                faithByPlayer: { 0: 0, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            expect(score).toBe(0);
        });

        it('should return 1000 for player with 1 region, no soldiers, and no faith', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] },
                faithByPlayer: { 0: 0, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            expect(score).toBe(1000);
        });

        it('should add soldier count * 10 to base region score', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }, { i: 3 }] }, // 3 soldiers
                faithByPlayer: { 0: 0, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 1 region * 1000 + 3 soldiers * 10 + 0 faith = 1030
            expect(score).toBe(1030);
        });

        it('should add faith to score', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] }, // 1 soldier
                faithByPlayer: { 0: 25, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 1 region * 1000 + 1 soldier * 10 + 25 faith = 1035
            expect(score).toBe(1035);
        });

        it('should calculate score correctly for multiple regions with faith', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 }, // 3 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }],     // 2 soldiers
                    1: [{ i: 3 }, { i: 4 }, { i: 5 }], // 3 soldiers
                    2: [{ i: 6 }]                // 1 soldier
                },
                faithByPlayer: { 0: 50, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 3 regions * 1000 + 6 soldiers * 10 + 50 faith = 3110
            expect(score).toBe(3110);
        });

        it('should only count regions owned by specified player', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 1, 2: 0 }, // Player 0 owns 2, Player 1 owns 1
                soldiersByRegion: {
                    0: [{ i: 1 }],
                    1: [{ i: 2 }, { i: 3 }], // These belong to player 1
                    2: [{ i: 4 }]
                },
                faithByPlayer: { 0: 10, 1: 20 }
            });

            const calculator = new ScoreCalculator(gameState);

            // Player 0: 2 regions * 1000 + 2 soldiers * 10 + 10 faith = 2030
            expect(calculator.calculatePlayerScore(0)).toBe(2030);

            // Player 1: 1 region * 1000 + 2 soldiers * 10 + 20 faith = 1040
            expect(calculator.calculatePlayerScore(1)).toBe(1040);
        });

        it('should handle large numbers of regions and soldiers', () => {
            const ownersByRegion: Record<number, number> = {};
            const soldiersByRegion: Record<number, { i: number }[]> = {};

            // Create 10 regions with 5 soldiers each
            for (let i = 0; i < 10; i++) {
                ownersByRegion[i] = 0;
                soldiersByRegion[i] = Array.from({ length: 5 }, (_, j) => ({ i: i * 10 + j }));
            }

            const gameState = createGameStateData({ 
                ownersByRegion, 
                soldiersByRegion,
                faithByPlayer: { 0: 0, 1: 0 }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 10 regions * 1000 + 50 soldiers * 10 + 0 faith = 10500
            expect(score).toBe(10500);
        });

        it('should use faith as tiebreaker when regions and soldiers are equal', () => {
            // This is the bug scenario: Barry vs Amber
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0, 2: 1, 3: 1 }, // Each has 2 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // Player 0: 2 soldiers
                    1: [{ i: 3 }],           // Player 0: 1 more = 3 total
                    2: [{ i: 4 }, { i: 5 }], // Player 1: 2 soldiers
                    3: [{ i: 6 }]            // Player 1: 1 more = 3 total
                },
                faithByPlayer: { 0: 18, 1: 25 } // Amber (player 1) has more faith
            });

            const calculator = new ScoreCalculator(gameState);

            // Player 0 (Barry): 2 * 1000 + 3 * 10 + 18 = 2048
            expect(calculator.calculatePlayerScore(0)).toBe(2048);

            // Player 1 (Amber): 2 * 1000 + 3 * 10 + 25 = 2055
            expect(calculator.calculatePlayerScore(1)).toBe(2055);

            // Amber wins because 2055 > 2048
            expect(calculator.calculatePlayerScore(1)).toBeGreaterThan(
                calculator.calculatePlayerScore(0)
            );
        });
    });

    describe('getRegionCount', () => {
        it('should return 0 when player owns no regions', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 1, 1: 1 } // All owned by player 1
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getRegionCount(0)).toBe(0);
        });

        it('should count all regions owned by player', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0, 2: 1, 3: 0, 4: 1 }
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getRegionCount(0)).toBe(3);
            expect(calculator.getRegionCount(1)).toBe(2);
        });

        it('should return 0 when ownersByRegion is empty', () => {
            const gameState = createGameStateData({
                ownersByRegion: {}
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getRegionCount(0)).toBe(0);
        });

        it('should handle undefined ownersByRegion gracefully', () => {
            const gameState = createGameStateData({});
            // @ts-ignore - Testing undefined case
            gameState.ownersByRegion = undefined;

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getRegionCount(0)).toBe(0);
        });
    });

    describe('getTotalSoldiers', () => {
        it('should return 0 when player has no soldiers', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(0);
        });

        it('should count soldiers across all owned regions', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }],
                    1: [{ i: 3 }],
                    2: [{ i: 4 }, { i: 5 }, { i: 6 }]
                }
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(6);
        });

        it('should not count soldiers in regions owned by other players', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }],
                    1: [{ i: 3 }, { i: 4 }, { i: 5 }] // Owned by player 1
                }
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(2);
            expect(calculator.getTotalSoldiers(1)).toBe(3);
        });

        it('should return 0 when ownersByRegion is undefined', () => {
            const gameState = createGameStateData({});
            // @ts-ignore - Testing undefined case
            gameState.ownersByRegion = undefined;

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(0);
        });

        it('should return 0 when soldiersByRegion is undefined', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 }
            });
            // @ts-ignore - Testing undefined case
            gameState.soldiersByRegion = undefined;

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(0);
        });

        it('should handle regions with undefined soldier arrays', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }]
                    // Region 1 has no soldiersByRegion entry
                }
            });

            const calculator = new ScoreCalculator(gameState);
            expect(calculator.getTotalSoldiers(0)).toBe(2);
        });
    });

    describe('score formula verification', () => {
        it('should use formula: (1000 * regionCount) + (10 * soldierCount) + faith', () => {
            const testCases = [
                { regions: 0, soldiers: 0, faith: 0, expected: 0 },
                { regions: 1, soldiers: 0, faith: 0, expected: 1000 },
                { regions: 1, soldiers: 0, faith: 50, expected: 1050 },
                { regions: 0, soldiers: 10, faith: 0, expected: 0 }, // No regions = no soldiers counted
                { regions: 2, soldiers: 5, faith: 10, expected: 2060 },  // 2000 + 50 + 10
                { regions: 5, soldiers: 25, faith: 100, expected: 5350 }, // 5000 + 250 + 100
                { regions: 10, soldiers: 100, faith: 0, expected: 11000 } // 10000 + 1000 + 0
            ];

            for (const { regions, soldiers, faith, expected } of testCases) {
                const ownersByRegion: Record<number, number> = {};
                const soldiersByRegion: Record<number, { i: number }[]> = {};

                // Distribute soldiers evenly across regions
                const soldiersPerRegion = regions > 0 ? Math.floor(soldiers / regions) : 0;
                const remainder = regions > 0 ? soldiers % regions : 0;

                for (let i = 0; i < regions; i++) {
                    ownersByRegion[i] = 0;
                    const count = soldiersPerRegion + (i < remainder ? 1 : 0);
                    soldiersByRegion[i] = Array.from({ length: count }, (_, j) => ({ i: i * 100 + j }));
                }

                const gameState = createGameStateData({ 
                    ownersByRegion, 
                    soldiersByRegion,
                    faithByPlayer: { 0: faith, 1: 0 }
                });
                const calculator = new ScoreCalculator(gameState);

                expect(calculator.calculatePlayerScore(0)).toBe(expected);
            }
        });
    });

    describe('getFaith', () => {
        it('should return faith for player', () => {
            const gameState = createGameStateData({
                faithByPlayer: { 0: 42, 1: 100 }
            });

            const calculator = new ScoreCalculator(gameState);

            expect(calculator.getFaith(0)).toBe(42);
            expect(calculator.getFaith(1)).toBe(100);
        });

        it('should return 0 for player with no faith entry', () => {
            const gameState = createGameStateData({
                faithByPlayer: { 1: 50 } // No entry for player 0
            });

            const calculator = new ScoreCalculator(gameState);

            expect(calculator.getFaith(0)).toBe(0);
        });

        it('should return 0 when faithByPlayer is undefined', () => {
            const gameState = createGameStateData({});
            // @ts-ignore - Testing undefined case
            gameState.faithByPlayer = undefined;

            const calculator = new ScoreCalculator(gameState);

            expect(calculator.getFaith(0)).toBe(0);
        });
    });
});
