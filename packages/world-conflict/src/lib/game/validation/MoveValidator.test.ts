/**
 * Unit tests for MoveValidator
 * Tests move validation rules for army movements
 */

import { describe, it, expect } from 'vitest';
import { MoveValidator } from './MoveValidator';
import type { GameStateData, Player } from '$lib/game/entities/gameTypes';
import { Region } from '$lib/game/entities/Region';

// Helper to create a region
function createRegion(index: number, neighbors: number[]): Region {
    return new Region({
        index,
        name: `Region ${index}`,
        neighbors,
        x: 100 + index * 50,
        y: 100,
        hasTemple: false,
        points: []
    });
}

// Helper to create a player
function createPlayer(slotIndex: number, name: string): Player {
    return {
        slotIndex,
        name,
        color: `#${slotIndex.toString().repeat(6)}`,
        isAI: false
    };
}

// Helper to create game state data for testing
function createTestGameState(options: {
    currentPlayerSlot?: number;
    players?: Player[];
    regions?: Region[];
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, { i: number }[]>;
}): GameStateData {
    return {
        id: 1,
        gameId: 'test-game',
        turnNumber: 1,
        currentPlayerSlot: options.currentPlayerSlot ?? 0,
        players: options.players ?? [
            createPlayer(0, 'Player 1'),
            createPlayer(1, 'Player 2')
        ],
        regions: options.regions ?? [
            createRegion(0, [1]),
            createRegion(1, [0, 2]),
            createRegion(2, [1])
        ],
        movesRemaining: 3,
        maxTurns: 100,
        ownersByRegion: options.ownersByRegion ?? {},
        soldiersByRegion: options.soldiersByRegion ?? {},
        templesByRegion: {},
        faithByPlayer: { 0: 100, 1: 100 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: 'test-seed'
    };
}

describe('MoveValidator', () => {
    describe('validateMove - ownership validation', () => {
        it('should reject move from region not owned by current player', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                ownersByRegion: { 0: 1 }, // Region 0 owned by player 1
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }] }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain("don't own");
        });

        it('should allow move from region owned by current player', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 }, // Both owned by player 0
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }],
                    1: [{ i: 4 }]
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });
    });

    describe('validateMove - adjacency validation', () => {
        it('should reject move to non-adjacent region', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),     // 0 is only adjacent to 1
                    createRegion(1, [0, 2]),
                    createRegion(2, [1])      // 2 is not adjacent to 0
                ],
                ownersByRegion: { 0: 0, 1: 0, 2: 0 },
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }],
                    1: [{ i: 4 }],
                    2: [{ i: 5 }]
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 2, 1); // 0 to 2 is not adjacent

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('not adjacent');
        });

        it('should allow move to adjacent region', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1, 2]),
                    createRegion(1, [0]),
                    createRegion(2, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }],
                    1: [{ i: 4 }]
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(true);
        });
    });

    describe('validateMove - soldier count validation', () => {
        it('should reject move with more soldiers than available', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }], // Only 2 soldiers
                    1: [{ i: 4 }]
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 5); // Trying to move 5

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Not enough soldiers');
        });

        it('should reject move that would leave source region empty', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }], // 2 soldiers
                    1: [{ i: 4 }]
                }
            });

            // Trying to move all 2 soldiers, leaving 0 behind
            const result = MoveValidator.validateMove(gameState, 0, 1, 2);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('leave at least 1 soldier');
        });

        it('should allow move that leaves at least 1 soldier', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }], // 3 soldiers
                    1: [{ i: 4 }]
                }
            });

            // Move 2 soldiers, leaving 1 behind
            const result = MoveValidator.validateMove(gameState, 0, 1, 2);

            expect(result.isValid).toBe(true);
        });

        it('should handle region with no soldiers', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: { 
                    0: [], // No soldiers
                    1: [{ i: 4 }]
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Not enough soldiers');
        });

        it('should handle missing soldiersByRegion entry', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: {} // No entries at all
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Not enough soldiers');
        });
    });

    describe('validateMove - current player validation', () => {
        it('should reject move when current player not found', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 5, // No player with this slot
                players: [
                    createPlayer(0, 'Player 1'),
                    createPlayer(1, 'Player 2')
                ],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }] }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Current player not found');
        });
    });

    describe('validateMove - valid moves', () => {
        it('should validate a completely valid move', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }, { i: 3 }] }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 2);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should allow attacking enemy region', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0, 1: 1 }, // Region 1 owned by enemy
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }],
                    1: [{ i: 4 }, { i: 5 }] // Enemy soldiers
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 2);

            expect(result.isValid).toBe(true);
        });

        it('should allow attacking neutral region', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0 }, // Region 1 has no owner (neutral)
                soldiersByRegion: { 
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }],
                    1: [{ i: 4 }] // Neutral soldiers
                }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 2);

            expect(result.isValid).toBe(true);
        });
    });

    describe('validateMove - edge cases', () => {
        it('should handle move with exactly 1 soldier when 2 available', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }] }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            expect(result.isValid).toBe(true);
        });

        it('should handle region with many soldiers', () => {
            const soldiers = Array.from({ length: 50 }, (_, i) => ({ i }));
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(0, [1]),
                    createRegion(1, [0])
                ],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: soldiers }
            });

            // Move almost all soldiers
            const result = MoveValidator.validateMove(gameState, 0, 1, 49);

            expect(result.isValid).toBe(true);
        });

        it('should handle source region not found in regions array', () => {
            const gameState = createTestGameState({
                currentPlayerSlot: 0,
                regions: [
                    createRegion(1, [0]), // No region with index 0
                ],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }] }
            });

            const result = MoveValidator.validateMove(gameState, 0, 1, 1);

            // Should fail because source region's neighbors can't be checked
            expect(result.isValid).toBe(false);
        });
    });
});
