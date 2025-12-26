/**
 * Unit tests for IncomeCalculator
 * Tests faith income calculation including temple bonuses
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IncomeCalculator } from './IncomeCalculator';
import { GameState, type Player } from '$lib/game/state/GameState';
import { TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';

// Helper to create a player
function createPlayer(slotIndex: number, name: string): Player {
    return {
        slotIndex,
        name,
        color: `#${slotIndex.toString().repeat(6)}`,
        isAI: false
    };
}

// Helper to create game state for income testing
function createIncomeTestGameState(options: {
    regions?: any[];
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, { i: number }[]>;
    templesByRegion?: Record<number, any>;
    players?: Player[];
}): GameState {
    const players = options.players ?? [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2')];

    const regions = options.regions ?? [
        {
            index: 0,
            name: 'Region 0',
            neighbors: [1],
            x: 100,
            y: 100,
            hasTemple: true,
            points: []
        },
        {
            index: 1,
            name: 'Region 1',
            neighbors: [0, 2],
            x: 150,
            y: 100,
            hasTemple: false,
            points: []
        },
        {
            index: 2,
            name: 'Region 2',
            neighbors: [1],
            x: 200,
            y: 100,
            hasTemple: true,
            points: []
        }
    ];

    return new GameState({
        id: 1,
        gameId: 'test-income',
        turnNumber: 1,
        currentPlayerSlot: 0,
        players,
        regions,
        movesRemaining: 3,
        maxTurns: 100,
        ownersByRegion: options.ownersByRegion ?? {},
        soldiersByRegion: options.soldiersByRegion ?? {},
        templesByRegion: options.templesByRegion ?? {},
        faithByPlayer: { 0: 100, 1: 100 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: 'test-seed'
    });
}

describe('IncomeCalculator', () => {
    describe('calculateIncome - basic income', () => {
        it('should return 0 for player with no regions', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: {} // Player owns nothing
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            expect(income).toBe(0);
        });

        it('should return region count as base income', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 }, // Player owns 3 regions
                templesByRegion: {} // No temples
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            expect(income).toBe(3); // 3 regions = 3 income
        });

        it('should only count regions owned by the specified player', () => {
            const player0 = createPlayer(0, 'Player 1');
            const player1 = createPlayer(1, 'Player 2');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 1, 2: 0 }, // Player 0 owns 2, Player 1 owns 1
                templesByRegion: {}
            });

            expect(IncomeCalculator.calculateIncome(gameState, player0)).toBe(2);
            expect(IncomeCalculator.calculateIncome(gameState, player1)).toBe(1);
        });
    });

    describe('calculateIncome - soldiers at temples', () => {
        it('should add income for soldiers stationed at owned temples', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0 }, // Player owns 1 region
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }, { i: 3 }] }, // 3 soldiers
                templesByRegion: { 0: { regionIndex: 0, level: 0 } } // Temple at region 0
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // 1 region + 3 soldiers praying = 4 income
            expect(income).toBe(4);
        });

        it('should not count soldiers at temples not owned by player', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 1, 1: 0 }, // Player 0 owns region 1, enemy owns 0
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // Soldiers at enemy temple
                    1: [{ i: 3 }] // Soldier at owned non-temple region
                },
                templesByRegion: { 0: { regionIndex: 0, level: 0 } }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Only region 1 counts (no temple there)
            expect(income).toBe(1);
        });

        it('should count soldiers at multiple owned temples', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // 2 soldiers at temple
                    1: [{ i: 3 }], // 1 soldier at non-temple
                    2: [{ i: 4 }, { i: 5 }, { i: 6 }] // 3 soldiers at temple
                },
                templesByRegion: {
                    0: { regionIndex: 0, level: 0 },
                    2: { regionIndex: 2, level: 0 }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // 3 regions + 5 soldiers at temples (2 + 3) = 8 income
            expect(income).toBe(8);
        });

        it('should not count soldiers at non-temple regions', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // Soldiers at temple
                    1: [{ i: 3 }, { i: 4 }, { i: 5 }, { i: 6 }] // Soldiers at non-temple
                },
                templesByRegion: {
                    0: { regionIndex: 0, level: 0 }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // 2 regions + 2 soldiers at temple = 4 income (soldiers at non-temple don't count)
            expect(income).toBe(4);
        });
    });

    describe('calculateIncome - Water temple bonus', () => {
        it('should apply Water temple percentage bonus to base income', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, // 5 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }] // 5 soldiers at temple
                },
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 0 // 20% bonus
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 5 regions + 5 soldiers = 10
            // Water bonus: 10 * 1.20 = 12
            expect(income).toBe(12);
        });

        it('should apply higher Water bonus at level 1', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, // 5 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }]
                },
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 1 // 40% bonus
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 5 regions + 5 soldiers = 10
            // Water bonus: 10 * 1.40 = 14
            expect(income).toBe(14);
        });

        it('should stack multiple Water temple bonuses', () => {
            const player = createPlayer(0, 'Player 1');
            const regions = Array.from({ length: 10 }, (_, i) => ({
                index: i,
                name: `Region ${i}`,
                neighbors: [],
                x: 100 + i * 50,
                y: 100,
                hasTemple: i < 2,
                points: []
            }));

            const gameState = createIncomeTestGameState({
                regions,
                ownersByRegion: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 0])), // 10 regions
                soldiersByRegion: {},
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 0 // 20% bonus
                    },
                    1: {
                        regionIndex: 1,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 0 // 20% bonus
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 10 regions + 0 soldiers = 10
            // Stacked Water bonus: 10 * (1 + 0.20 + 0.20) = 10 * 1.40 = 14
            expect(income).toBe(14);
        });

        it('should not apply bonus for non-Water temples', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0 },
                soldiersByRegion: {},
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index,
                        level: 1
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Fire temple has no income bonus
            expect(income).toBe(2);
        });
    });

    describe('calculateIncome - floor function', () => {
        it('should floor fractional income values', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0, 2: 0 }, // 3 regions
                soldiersByRegion: {},
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 0 // 20% bonus
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 3 regions = 3
            // Water bonus: 3 * 1.20 = 3.6 -> floored to 3
            expect(income).toBe(3);
        });
    });

    describe('calculateIncome - edge cases', () => {
        it('should handle empty temple at region', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }, // No soldiers
                templesByRegion: { 0: { regionIndex: 0, level: 0 } }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            expect(income).toBe(1); // Just the region
        });

        it('should handle Water temple at unowned region', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 1, 1: 0 }, // Player doesn't own temple region
                soldiersByRegion: {},
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 1 // Enemy's Water temple
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Player only owns region 1, no bonus from enemy's Water temple
            expect(income).toBe(1);
        });

        it('should handle mixed temple types', () => {
            const player = createPlayer(0, 'Player 1');
            const regions = Array.from({ length: 5 }, (_, i) => ({
                index: i,
                name: `Region ${i}`,
                neighbors: [],
                x: 100 + i * 50,
                y: 100,
                hasTemple: true,
                points: []
            }));

            const gameState = createIncomeTestGameState({
                regions,
                ownersByRegion: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
                soldiersByRegion: {
                    0: [{ i: 1 }], // 1 soldier at Water temple
                    1: [{ i: 2 }], // 1 soldier at Fire temple
                    2: [{ i: 3 }] // 1 soldier at Earth temple
                },
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 0 // 20% bonus
                    },
                    1: {
                        regionIndex: 1,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index,
                        level: 0
                    },
                    2: {
                        regionIndex: 2,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.EARTH.index,
                        level: 0
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 5 regions + 3 soldiers at temples = 8
            // Water bonus: 8 * 1.20 = 9.6 -> 9
            expect(income).toBe(9);
        });
    });

    describe('calculateIncome - complete scenarios', () => {
        it('should calculate income for typical early game state', () => {
            const player = createPlayer(0, 'Player 1');
            const gameState = createIncomeTestGameState({
                ownersByRegion: { 0: 0, 1: 0 }, // 2 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // 2 soldiers at temple
                    1: [{ i: 3 }] // 1 soldier (no temple)
                },
                templesByRegion: {
                    0: { regionIndex: 0, level: 0 } // Basic temple
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // 2 regions + 2 soldiers praying = 4
            expect(income).toBe(4);
        });

        it('should calculate income for mid-game with upgrades', () => {
            const player = createPlayer(0, 'Player 1');
            const regions = Array.from({ length: 6 }, (_, i) => ({
                index: i,
                name: `Region ${i}`,
                neighbors: [],
                x: 100 + i * 50,
                y: 100,
                hasTemple: i < 2,
                points: []
            }));

            const gameState = createIncomeTestGameState({
                regions,
                ownersByRegion: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, // 6 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }], // 3 soldiers at Water temple
                    1: [{ i: 4 }, { i: 5 }] // 2 soldiers at Fire temple
                },
                templesByRegion: {
                    0: {
                        regionIndex: 0,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.WATER.index,
                        level: 1 // 40% bonus
                    },
                    1: {
                        regionIndex: 1,
                        upgradeIndex: TEMPLE_UPGRADES_BY_NAME.FIRE.index,
                        level: 0
                    }
                }
            });

            const income = IncomeCalculator.calculateIncome(gameState, player);

            // Base: 6 regions + 5 soldiers at temples = 11
            // Water bonus: 11 * 1.40 = 15.4 -> 15
            expect(income).toBe(15);
        });
    });
});
