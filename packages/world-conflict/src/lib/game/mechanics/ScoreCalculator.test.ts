/**
 * Unit tests for ScoreCalculator
 * Tests player score calculation based on regions and soldiers
 */

import { describe, it, expect } from 'vitest';
import { ScoreCalculator } from './ScoreCalculator';
import type { GameStateData } from '$lib/game/entities/gameTypes';

// Helper to create minimal game state data for testing
function createGameStateData(options: {
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, { i: number }[]>;
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
        faithByPlayer: { 0: 100, 1: 100 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: 'test-seed'
    };
}

describe('ScoreCalculator', () => {
    describe('calculatePlayerScore', () => {
        it('should return 0 for player with no regions and no soldiers', () => {
            const gameState = createGameStateData({
                ownersByRegion: {},
                soldiersByRegion: {}
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            expect(score).toBe(0);
        });

        it('should return 1000 for player with 1 region and no soldiers', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            expect(score).toBe(1000);
        });

        it('should add soldier count to base region score', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }, { i: 3 }] } // 3 soldiers
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 1 region * 1000 + 3 soldiers = 1003
            expect(score).toBe(1003);
        });

        it('should calculate score correctly for multiple regions', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 }, // 3 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }],     // 2 soldiers
                    1: [{ i: 3 }, { i: 4 }, { i: 5 }], // 3 soldiers
                    2: [{ i: 6 }]                // 1 soldier
                }
            });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 3 regions * 1000 + 6 soldiers = 3006
            expect(score).toBe(3006);
        });

        it('should only count regions owned by specified player', () => {
            const gameState = createGameStateData({
                ownersByRegion: { 0: 0, 1: 1, 2: 0 }, // Player 0 owns 2, Player 1 owns 1
                soldiersByRegion: {
                    0: [{ i: 1 }],
                    1: [{ i: 2 }, { i: 3 }], // These belong to player 1
                    2: [{ i: 4 }]
                }
            });

            const calculator = new ScoreCalculator(gameState);

            // Player 0: 2 regions * 1000 + 2 soldiers = 2002
            expect(calculator.calculatePlayerScore(0)).toBe(2002);

            // Player 1: 1 region * 1000 + 2 soldiers = 1002
            expect(calculator.calculatePlayerScore(1)).toBe(1002);
        });

        it('should handle large numbers of regions and soldiers', () => {
            const ownersByRegion: Record<number, number> = {};
            const soldiersByRegion: Record<number, { i: number }[]> = {};

            // Create 10 regions with 5 soldiers each
            for (let i = 0; i < 10; i++) {
                ownersByRegion[i] = 0;
                soldiersByRegion[i] = Array.from({ length: 5 }, (_, j) => ({ i: i * 10 + j }));
            }

            const gameState = createGameStateData({ ownersByRegion, soldiersByRegion });

            const calculator = new ScoreCalculator(gameState);
            const score = calculator.calculatePlayerScore(0);

            // 10 regions * 1000 + 50 soldiers = 10050
            expect(score).toBe(10050);
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
        it('should use formula: (1000 * regionCount) + soldierCount', () => {
            const testCases = [
                { regions: 0, soldiers: 0, expected: 0 },
                { regions: 1, soldiers: 0, expected: 1000 },
                { regions: 0, soldiers: 10, expected: 0 }, // No regions = no soldiers counted for owned regions
                { regions: 2, soldiers: 5, expected: 2005 },
                { regions: 5, soldiers: 25, expected: 5025 },
                { regions: 10, soldiers: 100, expected: 10100 }
            ];

            for (const { regions, soldiers, expected } of testCases) {
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

                const gameState = createGameStateData({ ownersByRegion, soldiersByRegion });
                const calculator = new ScoreCalculator(gameState);

                expect(calculator.calculatePlayerScore(0)).toBe(expected);
            }
        });
    });
});

