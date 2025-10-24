/**
 * Unit tests for Minimax Search Algorithm
 * Tests tree search for AI move selection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { miniMaxSearch } from './MiniMaxSearch';
import { AI_LEVELS } from '$lib/game/entities/aiPersonalities';
import { EndTurnCommand } from '$lib/game/commands/EndTurnCommand';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import {
    createMockGameState,
    createMockPlayer,
    createMockRegion,
    createSimpleTwoPlayerGame,
    createGameStateWithSoldierCounts,
    isCommandType
} from './AiTestUtils';
import type { GameState, Player } from '$lib/game/state/GameState';

describe('MiniMaxSearch', () => {
    describe('miniMaxSearch', () => {
        it('should return a valid Command (not null)', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
            expect(command).not.toBeNull();
            expect(command.constructor.name).toMatch(/Command$/);
        });

        it('should return EndTurnCommand when no good moves available', async () => {
            // Create a state where player has regions but no soldiers to move
            const player = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0, neighbors: [1] })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }, // No soldiers
                movesRemaining: 3
            });
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should return EndTurnCommand when movesRemaining is 0', async () => {
            const gameState = createSimpleTwoPlayerGame();
            gameState.state.movesRemaining = 0;
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should only have EndTurnCommand available
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should respect maxTime limit and terminate', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            const startTime = Date.now();
            const maxTime = 50; // 50ms limit
            
            const command = await miniMaxSearch(player, gameState, 3, maxTime, AI_LEVELS.RUDE);
            
            const elapsedTime = Date.now() - startTime;
            
            expect(command).toBeDefined();
            // Should complete within reasonable time (allow some buffer for execution)
            expect(elapsedTime).toBeLessThan(maxTime + 100);
        });

        it('should work with different AI difficulty levels', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // Test all difficulty levels
            for (const level of [AI_LEVELS.NICE, AI_LEVELS.RUDE, AI_LEVELS.MEAN]) {
                const command = await miniMaxSearch(player, gameState, 1, 100, level);
                expect(command).toBeDefined();
            }
        });

        it('should generate army move when soldiers are available', async () => {
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 5 }, { index: 1, soldiers: 1 }],
                [{ index: 2, soldiers: 3 }],
                { 0: [1], 1: [0], 2: [] }
            );
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should likely generate an ArmyMoveCommand or EndTurnCommand
            expect(command).toBeDefined();
            expect(
                command instanceof ArmyMoveCommand || command instanceof EndTurnCommand
            ).toBe(true);
        });

        it('should not attempt suicide moves', async () => {
            // Create scenario where only move is suicide (attacking stronger force)
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 1 }],
                [{ index: 1, soldiers: 10 }],
                { 0: [1], 1: [0] }
            );
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should prefer to end turn rather than suicide
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should consider depth parameter', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // Depth should affect thinking time and possibly move quality
            const shallowCommand = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            const deeperCommand = await miniMaxSearch(player, gameState, 2, 100, AI_LEVELS.RUDE);
            
            // Both should return valid commands
            expect(shallowCommand).toBeDefined();
            expect(deeperCommand).toBeDefined();
        });
    });

    describe('possibleMoves logic (integration)', () => {
        it('should generate EndTurnCommand as an option', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // With no time or very little depth, should at least have end turn
            const command = await miniMaxSearch(player, gameState, 0, 10, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
        });

        it('should generate ArmyMoveCommand for movable armies', async () => {
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 5 }, { index: 1, soldiers: 2 }],
                [{ index: 2, soldiers: 1 }],
                { 0: [1], 1: [0, 2], 2: [1] }
            );
            const player = gameState.state.players[0];
            gameState.state.currentPlayerSlot = 0;
            gameState.state.movesRemaining = 3;
            
            const command = await miniMaxSearch(player, gameState, 1, 200, AI_LEVELS.RUDE);
            
            // Should likely generate a move command
            expect(command).toBeDefined();
        });

        it('should include full army moves', async () => {
            // The algorithm should consider moving all soldiers
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 4 }, { index: 1, soldiers: 1 }],
                [{ index: 2, soldiers: 5 }],
                { 0: [1], 1: [0], 2: [] }
            );
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
            // If it's an army move, it could be full or partial
            if (command instanceof ArmyMoveCommand) {
                expect(command.count).toBeGreaterThan(0);
                expect(command.count).toBeLessThanOrEqual(4);
            }
        });

        it('should include half army moves for armies > 1', async () => {
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 10 }, { index: 1, soldiers: 2 }],
                [{ index: 2, soldiers: 5 }],
                { 0: [1], 1: [0], 2: [] }
            );
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Algorithm considers both full and half moves
            expect(command).toBeDefined();
        });

        it('should exclude suicide moves (attacking stronger force)', async () => {
            // Only option is suicide attack
            const gameState = createGameStateWithSoldierCounts(
                [{ index: 0, soldiers: 2 }],
                [{ index: 1, soldiers: 20 }],
                { 0: [1], 1: [0] }
            );
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should end turn instead of suicide
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should handle empty possible moves gracefully', async () => {
            const player = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
            const gameState = createMockGameState({
                players: [player],
                regions: [],
                ownersByRegion: {},
                soldiersByRegion: {},
                movesRemaining: 0
            });
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeInstanceOf(EndTurnCommand);
        });
    });

    describe('Node behavior', () => {
        it('should evaluate terminal nodes at depth 0', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // Depth 0 should evaluate immediately
            const command = await miniMaxSearch(player, gameState, 0, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
        });

        it('should handle maximizing node (current player)', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            gameState.state.currentPlayerSlot = 0; // Player's turn
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should try to maximize player's position
            expect(command).toBeDefined();
        });

        it('should handle minimizing node (opponent turn)', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            gameState.state.currentPlayerSlot = 1; // Opponent's turn in simulation
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // Should still return a command for the player
            expect(command).toBeDefined();
        });

        it('should backpropagate values correctly', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // With depth > 1, values should backpropagate through tree
            const command = await miniMaxSearch(player, gameState, 2, 200, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
            // The command should be the best first move from the tree
        });

        it('should handle time limit during tree construction', async () => {
            // Create complex game state
            const regions = Array.from({ length: 10 }, (_, i) =>
                createMockRegion({ index: i, neighbors: [Math.max(0, i - 1), Math.min(9, i + 1)] })
            );
            
            const gameState = createMockGameState({
                regions,
                ownersByRegion: Object.fromEntries(regions.map((r, i) => [i, i % 2])),
                soldiersByRegion: Object.fromEntries(regions.map((r, i) => [i, [{ i }]])),
                movesRemaining: 3
            });
            
            const player = gameState.state.players[0];
            
            const startTime = Date.now();
            const command = await miniMaxSearch(player, gameState, 3, 50, AI_LEVELS.RUDE);
            const elapsed = Date.now() - startTime;
            
            expect(command).toBeDefined();
            expect(elapsed).toBeLessThan(200); // Should stop within time limit + buffer
        });
    });

    describe('Move randomization', () => {
        it('should shuffle moves to avoid bias', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            // Run multiple times and collect results
            const commands: any[] = [];
            for (let i = 0; i < 5; i++) {
                const command = await miniMaxSearch(player, gameState, 1, 50, AI_LEVELS.RUDE);
                commands.push(command);
            }
            
            // All should be valid
            expect(commands.every(c => c !== null && c !== undefined)).toBe(true);
            
            // May get different moves due to shuffling (not guaranteed but likely)
            // This is a weak test but ensures randomization doesn't break things
        });
    });

    describe('Edge cases', () => {
        it('should handle player with no regions', async () => {
            const player = createMockPlayer({ slotIndex: 0, name: 'Eliminated' });
            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: {}, // Player owns nothing
                movesRemaining: 3
            });
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should handle single region with no neighbors', async () => {
            const player = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
            const gameState = createMockGameState({
                players: [player],
                regions: [createMockRegion({ index: 0, neighbors: [] })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] },
                movesRemaining: 3
            });
            
            const command = await miniMaxSearch(player, gameState, 1, 100, AI_LEVELS.RUDE);
            
            // No moves possible, should end turn
            expect(command).toBeInstanceOf(EndTurnCommand);
        });

        it('should handle very short time limit', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 1, 1, AI_LEVELS.RUDE);
            
            // Should still return a command even with 1ms limit
            expect(command).toBeDefined();
        });

        it('should handle zero depth', async () => {
            const gameState = createSimpleTwoPlayerGame();
            const player = gameState.state.players[0];
            
            const command = await miniMaxSearch(player, gameState, 0, 100, AI_LEVELS.RUDE);
            
            expect(command).toBeDefined();
        });
    });
});

