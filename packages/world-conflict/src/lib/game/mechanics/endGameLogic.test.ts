/**
 * Unit tests for endGameLogic
 * Tests game end detection and winner determination
 */

import { describe, it, expect } from 'vitest';
import { checkGameEnd } from './endGameLogic';
import type { GameStateData, Player } from '$lib/game/entities/gameTypes';

// Helper to create a player
function createPlayer(slotIndex: number, name: string): Player {
    return {
        slotIndex,
        name,
        color: `#${slotIndex.toString().repeat(6)}`,
        isAI: false
    };
}

// Helper to create game state data
function createGameState(options: {
    turnNumber?: number;
    maxTurns?: number;
    players?: Player[];
    ownersByRegion?: Record<number, number>;
    soldiersByRegion?: Record<number, { i: number }[]>;
    faithByPlayer?: Record<number, number>;
}): GameStateData {
    return {
        id: 1,
        gameId: 'test-game',
        turnNumber: options.turnNumber ?? 1,
        maxTurns: options.maxTurns ?? 10,
        currentPlayerSlot: 0,
        players: options.players ?? [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2')],
        regions: [],
        movesRemaining: 3,
        ownersByRegion: options.ownersByRegion ?? {},
        soldiersByRegion: options.soldiersByRegion ?? {},
        templesByRegion: {},
        faithByPlayer: options.faithByPlayer ?? { 0: 0, 1: 0 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: 'test-seed'
    };
}

describe('endGameLogic', () => {
    describe('checkGameEnd - turn limit', () => {
        it('should not end game before turn limit', () => {
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 1 }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(false);
            expect(result.winner).toBeNull();
        });

        it('should end game when turn limit reached', () => {
            const gameState = createGameState({
                turnNumber: 10, // Will be checked as turn 11 (1-indexed)
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 0, 2: 1 }, // Player 0 has 2 regions, Player 1 has 1
                soldiersByRegion: { 0: [], 1: [], 2: [] }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('TURN_LIMIT');
            expect(result.winner).not.toBe('DRAWN_GAME');
        });

        it('should end game after maxTurns rounds complete', () => {
            // After maxTurns rounds complete: turnNumber = maxTurns - 1
            // With turnNumber >= maxTurns check: after round maxTurns, turnNumber = maxTurns - 1, false, continue
            // After round maxTurns+1: turnNumber = maxTurns, turnNumber >= maxTurns? true, end
            // This allows maxTurns rounds to complete before ending
            const gameState = createGameState({
                turnNumber: 3, // After round 4, turnNumber = 3, 3 >= 3 = true
                maxTurns: 3,
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('TURN_LIMIT');
        });

        it('should NOT end game one turn before limit', () => {
            // turnNumber = 1 means currentTurn = 2, maxTurns = 3, 2 >= 3 = false
            const gameState = createGameState({
                turnNumber: 1,
                maxTurns: 3,
                ownersByRegion: { 0: 0, 1: 1 }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(false);
        });

        it('should not end game with unlimited turns', () => {
            const gameState = createGameState({
                turnNumber: 100,
                maxTurns: 999, // UNLIMITED_TURNS
                ownersByRegion: { 0: 0, 1: 1 }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(false);
        });

        it('should not end game when maxTurns is 0 (unlimited)', () => {
            const gameState = createGameState({
                turnNumber: 50,
                maxTurns: 0,
                ownersByRegion: { 0: 0, 1: 1 }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(false);
        });
    });

    describe('checkGameEnd - elimination', () => {
        it('should end game when one player eliminated', () => {
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 0, 2: 0 } // Player 0 owns all, Player 1 has 0 regions
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('ELIMINATION');
            expect(result.winner).toEqual(gameState.players[0]);
        });

        it('should not end game when both players have regions', () => {
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 1 }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(false);
        });

        it('should declare DRAWN_GAME when all players eliminated (edge case)', () => {
            // This shouldn't happen in practice, but test the edge case
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                ownersByRegion: {} // No regions owned by anyone
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('ELIMINATION');
            expect(result.winner).toBe('DRAWN_GAME');
        });

        it('should handle 3-player game with one eliminated', () => {
            const players = [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2'), createPlayer(2, 'Player 3')];
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 0, 1: 1 } // Player 2 eliminated
            });

            const result = checkGameEnd(gameState, players);

            // Game should continue - still 2 active players
            expect(result.isGameEnded).toBe(false);
        });

        it('should end 3-player game when only one player remains', () => {
            const players = [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2'), createPlayer(2, 'Player 3')];
            const gameState = createGameState({
                turnNumber: 5,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 2, 1: 2, 2: 2 } // Only Player 3 (slot 2) has regions
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('ELIMINATION');
            expect(result.winner).toEqual(players[2]);
        });

        it('should prioritize turn limit over elimination check', () => {
            // Turn limit is checked first, so if both conditions are met,
            // turn limit should be the reason
            const gameState = createGameState({
                turnNumber: 10, // turnNumber >= maxTurns = 10
                maxTurns: 10,
                ownersByRegion: { 0: 0 } // Also would trigger elimination
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('TURN_LIMIT'); // Not ELIMINATION
        });
    });

    describe('checkGameEnd - winner determination by score', () => {
        it('should declare winner with more regions', () => {
            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 0, 2: 0, 3: 1 }, // Player 0 has 3 regions, Player 1 has 1
                soldiersByRegion: {
                    0: [{ i: 1 }],
                    1: [{ i: 2 }],
                    2: [{ i: 3 }],
                    3: [{ i: 4 }]
                }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toEqual(gameState.players[0]); // Player 0 wins
        });

        it('should declare winner with more soldiers when regions are equal', () => {
            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                ownersByRegion: { 0: 0, 1: 0, 2: 1, 3: 1 }, // Each has 2 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }, { i: 3 }], // Player 0: 3 soldiers
                    1: [{ i: 4 }, { i: 5 }], // Player 0: 2 more = 5 total
                    2: [{ i: 6 }], // Player 1: 1 soldier
                    3: [{ i: 7 }] // Player 1: 1 more = 2 total
                }
            });

            const result = checkGameEnd(gameState, gameState.players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toEqual(gameState.players[0]); // Player 0 wins (5 soldiers vs 2)
        });

        it('should include faith in score calculation', () => {
            const players = [createPlayer(0, 'Barry'), createPlayer(1, 'Amber')];

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 0, 1: 0, 2: 1, 3: 1 }, // Each has 2 regions
                soldiersByRegion: {
                    0: [{ i: 1 }, { i: 2 }], // Barry: 2 soldiers
                    1: [{ i: 3 }], // Barry: 1 more = 3 total
                    2: [{ i: 4 }, { i: 5 }], // Amber: 2 soldiers
                    3: [{ i: 6 }] // Amber: 1 more = 3 total
                },
                faithByPlayer: {
                    0: 18, // Barry: 18 faith -> score = 2000 + 30 + 18 = 2048
                    1: 25 // Amber: 25 faith -> score = 2000 + 30 + 25 = 2055 (wins!)
                }
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toEqual(players[1]); // Amber wins due to higher faith in score
        });

        it('should declare draw only when scores are exactly equal', () => {
            const players = [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2')];

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 0, 1: 1 }, // Each has 1 region
                soldiersByRegion: {
                    0: [{ i: 1 }], // Each has 1 soldier
                    1: [{ i: 2 }]
                },
                faithByPlayer: {
                    0: 50, // Same faith -> both score = 1000 + 10 + 50 = 1060
                    1: 50
                }
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toBe('DRAWN_GAME');
        });

        it('should declare draw in 3-way tie', () => {
            const players = [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2'), createPlayer(2, 'Player 3')];

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 0, 1: 1, 2: 2 }, // Each has 1 region
                soldiersByRegion: {
                    0: [{ i: 1 }], // Each has 1 soldier
                    1: [{ i: 2 }],
                    2: [{ i: 3 }]
                },
                faithByPlayer: {
                    0: 50,
                    1: 50,
                    2: 50
                }
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toBe('DRAWN_GAME');
        });

        it('should not declare draw when only 2 of 3 players are tied', () => {
            const players = [createPlayer(0, 'Player 1'), createPlayer(1, 'Player 2'), createPlayer(2, 'Player 3')];

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 0, 1: 1, 2: 2, 3: 2 }, // Player 3 has 2 regions
                soldiersByRegion: {
                    0: [{ i: 1 }],
                    1: [{ i: 2 }],
                    2: [{ i: 3 }],
                    3: [{ i: 4 }]
                },
                faithByPlayer: {
                    0: 50,
                    1: 50,
                    2: 50
                }
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.winner).toEqual(players[2]); // Player 3 wins with 2 regions
        });

        it('should handle AI player winning', () => {
            const players = [
                { slotIndex: 0, name: 'Human', color: '#000', isAI: false },
                { slotIndex: 1, name: 'AI Bot', color: '#111', isAI: true }
            ];

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion: { 0: 1, 1: 1, 2: 1 }, // AI owns all regions
                soldiersByRegion: {}
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('TURN_LIMIT');
            expect((result.winner as Player).isAI).toBe(true);
            expect((result.winner as Player).name).toBe('AI Bot');
        });

        it('should handle the exact scenario from bug report', () => {
            // Barry: 4 regions, 11 soldiers, 18 faith -> 4000 + 110 + 18 = 4128
            // Amber: 4 regions, 11 soldiers, 25 faith -> 4000 + 110 + 25 = 4135
            // Amber should win!

            const players = [createPlayer(0, 'Barry'), createPlayer(1, 'Amber')];

            // Set up 4 regions each with soldiers distributed to total 11 each
            const ownersByRegion: Record<number, number> = {
                0: 0,
                1: 0,
                2: 0,
                3: 0, // Barry owns regions 0-3
                4: 1,
                5: 1,
                6: 1,
                7: 1 // Amber owns regions 4-7
            };

            const soldiersByRegion: Record<number, { i: number }[]> = {
                0: Array.from({ length: 3 }, (_, i) => ({ i })),
                1: Array.from({ length: 3 }, (_, i) => ({ i: 10 + i })),
                2: Array.from({ length: 3 }, (_, i) => ({ i: 20 + i })),
                3: Array.from({ length: 2 }, (_, i) => ({ i: 30 + i })), // Total: 11 soldiers for Barry
                4: Array.from({ length: 3 }, (_, i) => ({ i: 40 + i })),
                5: Array.from({ length: 3 }, (_, i) => ({ i: 50 + i })),
                6: Array.from({ length: 3 }, (_, i) => ({ i: 60 + i })),
                7: Array.from({ length: 2 }, (_, i) => ({ i: 70 + i })) // Total: 11 soldiers for Amber
            };

            const gameState = createGameState({
                turnNumber: 10,
                maxTurns: 10,
                players,
                ownersByRegion,
                soldiersByRegion,
                faithByPlayer: {
                    0: 18, // Barry
                    1: 25 // Amber
                }
            });

            const result = checkGameEnd(gameState, players);

            expect(result.isGameEnded).toBe(true);
            expect(result.reason).toBe('TURN_LIMIT');
            // Amber should win because she has more faith (25 vs 18)
            expect(result.winner).toEqual(players[1]); // Amber
            expect((result.winner as Player).name).toBe('Amber');
        });
    });
});
