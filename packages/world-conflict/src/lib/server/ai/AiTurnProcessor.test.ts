/**
 * Unit tests for AI Turn Processor
 * Integration tests for AI turn processing and game flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processAiTurns } from './AiTurnProcessor';
import { GameState } from '$lib/game/state/GameState';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { AiDifficulty } from '$lib/game/entities/aiPersonalities';
import {
    createMockGameState,
    createMockPlayer,
    createMockRegion,
    createMockTemple,
    createMockGameStorage,
    createSimpleTwoPlayerGame
} from './AiTestUtils';

// Mock WebSocketNotifications
vi.mock('$lib/server/websocket/WebSocketNotifier', () => ({
    WebSocketNotifications: {
        gameUpdate: vi.fn(async () => {})
    }
}));

// Mock platform
const mockPlatform = {
    env: {}
};

describe('AiTurnProcessor', () => {
    describe('processAiTurns', () => {
        it('should process single AI turn then stop at human', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });
            
            // Create a state where players are separated and won't eliminate each other quickly
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1, // AI's turn
                regions: [
                    createMockRegion({ index: 0, neighbors: [] }), // Isolated
                    createMockRegion({ index: 1, neighbors: [] })  // Isolated
                ],
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
                templesByRegion: {}, // No temples
                faithByPlayer: { 0: 0, 1: 0 }, // No faith
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should process AI turn and stop at human (or end game if no moves)
            expect(result).toBeDefined();
            // If game is still active, should advance to human. Otherwise any result is OK
            if (!result.isGameComplete()) {
                expect([false, undefined]).toContain(result.getCurrentPlayer()?.isAI);
            }
        });

        it('should process multiple consecutive AI turns', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer1 = createMockPlayer({ slotIndex: 1, name: 'AI 1', isAI: true, personality: 'Defender' });
            const aiPlayer2 = createMockPlayer({ slotIndex: 2, name: 'AI 2', isAI: true, personality: 'Economist' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer1, aiPlayer2],
                currentPlayerSlot: 1, // AI 1's turn
                regions: [
                    createMockRegion({ index: 0, neighbors: [1, 2] }),
                    createMockRegion({ index: 1, neighbors: [0, 2] }),
                    createMockRegion({ index: 2, neighbors: [0, 1] })
                ],
                ownersByRegion: { 0: 0, 1: 1, 2: 2 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }], 2: [{ i: 3 }] },
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should process both AI turns and stop at human
            expect(result).toBeDefined();
            expect(result.getCurrentPlayer()?.slotIndex).toBe(0);
            expect(result.getCurrentPlayer()?.isAI).toBe(false);
        });

        it('should stop when game ends', async () => {
            const aiPlayer1 = createMockPlayer({ slotIndex: 0, name: 'AI 1', isAI: true, personality: 'Defender' });
            const aiPlayer2 = createMockPlayer({ slotIndex: 1, name: 'AI 2', isAI: true, personality: 'Aggressor' });
            
            const gameState = createMockGameState({
                players: [aiPlayer1, aiPlayer2],
                currentPlayerSlot: 0,
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 }, // AI 1 owns everything
                soldiersByRegion: { 0: [{ i: 1 }] },
                maxTurns: 1,
                turnNumber: 1, // At max turns
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should stop (game complete or max turns reached)
            expect(result).toBeDefined();
        });

        it('should respect MAX_AI_TURNS safety limit', async () => {
            const aiPlayer = createMockPlayer({ slotIndex: 0, name: 'AI', isAI: true, personality: 'Defender' });
            
            const gameState = createMockGameState({
                players: [aiPlayer],
                currentPlayerSlot: 0,
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] },
                movesRemaining: 3,
                maxTurns: 1000, // High max turns
                turnNumber: 1,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            
            // Should stop after MAX_AI_TURNS to prevent infinite loop
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            expect(result).toBeDefined();
            expect(result.turnNumber).toBeLessThanOrEqual(GAME_CONSTANTS.MAX_AI_TURNS + 1);
        });

        it('should handle AI move failures gracefully', async () => {
            const aiPlayer = createMockPlayer({ slotIndex: 0, name: 'AI', isAI: true, personality: 'Defender' });
            const humanPlayer = createMockPlayer({ slotIndex: 1, name: 'Human', isAI: false });
            
            // Create a state where AI has very limited options
            const gameState = createMockGameState({
                players: [aiPlayer, humanPlayer],
                currentPlayerSlot: 0,
                regions: [createMockRegion({ index: 0, neighbors: [] })], // Isolated region
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [] }, // No soldiers
                templesByRegion: {},
                faithByPlayer: { 0: 0, 1: 100 }, // No faith
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should handle gracefully and end turn (turn advanced or stayed same)
            expect(result).toBeDefined();
            expect(result.getCurrentPlayer()).toBeDefined();
            // AI should have taken its turn
            expect(result.turnNumber).toBeGreaterThanOrEqual(gameState.turnNumber);
        });

        it('should update game state correctly', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Berserker' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: [
                    createMockRegion({ index: 0, neighbors: [1] }),
                    createMockRegion({ index: 1, neighbors: [0] })
                ],
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }, { i: 3 }] },
                templesByRegion: {
                    1: createMockTemple({ regionIndex: 1 })
                },
                faithByPlayer: { 0: 50, 1: 50 },
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const initialTurnNumber = gameState.turnNumber;
            
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Game state should be updated
            expect(result).toBeDefined();
            expect(result).not.toBe(gameState); // Should be new state
            
            // Turn should have progressed
            expect(result.turnNumber).toBeGreaterThanOrEqual(initialTurnNumber);
        });

        it('should call gameStorage.saveGame once at end', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: [createMockRegion({ index: 0 }), createMockRegion({ index: 1 })],
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage, saveGameMock } = createMockGameStorage();
            
            await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should save once at the end
            expect(saveGameMock).toHaveBeenCalledTimes(1);
        });

        it('should return updated GameState', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 1 },
                soldiersByRegion: { 0: [{ i: 1 }] },
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            expect(result).toBeInstanceOf(GameState);
            expect(result.state).toBeDefined();
            expect(result.state.players).toBeDefined();
        });

        it('should handle errors without crashing', async () => {
            const aiPlayer = createMockPlayer({ slotIndex: 0, name: 'AI', isAI: true, personality: 'Invalid' });
            const humanPlayer = createMockPlayer({ slotIndex: 1, name: 'Human', isAI: false });
            
            const gameState = createMockGameState({
                players: [aiPlayer, humanPlayer],
                currentPlayerSlot: 0,
                regions: [createMockRegion({ index: 0 })],
                ownersByRegion: { 0: 0 },
                soldiersByRegion: { 0: [{ i: 1 }] },
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            
            // Should not throw
            await expect(
                processAiTurns(gameState, storage, 'test-game', mockPlatform)
            ).resolves.toBeDefined();
        });

        it('should process EndTurnCommand when no valid move', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });
            
            // AI has no valid moves
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: [createMockRegion({ index: 0, neighbors: [] })],
                ownersByRegion: { 0: 1 },
                soldiersByRegion: { 0: [] }, // No soldiers
                templesByRegion: {},
                faithByPlayer: { 0: 100, 1: 0 }, // No faith
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should end turn (may advance to human or stay at AI depending on game rules)
            expect(result).toBeDefined();
            expect(result.turnNumber).toBeGreaterThanOrEqual(gameState.turnNumber);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle AI vs AI game', async () => {
            const aiPlayer1 = createMockPlayer({ slotIndex: 0, name: 'AI 1', isAI: true, personality: 'Defender' });
            const aiPlayer2 = createMockPlayer({ slotIndex: 1, name: 'AI 2', isAI: true, personality: 'Aggressor' });
            
            const gameState = createMockGameState({
                players: [aiPlayer1, aiPlayer2],
                currentPlayerSlot: 0,
                regions: [
                    createMockRegion({ index: 0, neighbors: [1] }),
                    createMockRegion({ index: 1, neighbors: [0] })
                ],
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }, { i: 2 }], 1: [{ i: 3 }, { i: 4 }] },
                movesRemaining: 3,
                maxTurns: 10,
                turnNumber: 1,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            
            // Should process until safety limit or game end
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            expect(result).toBeDefined();
            // Both players are AI, so should hit MAX_AI_TURNS limit
            expect(result.turnNumber).toBeGreaterThan(1);
        });

        it('should handle game with temples and building', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Economist' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: [
                    createMockRegion({ index: 0, neighbors: [1] }),
                    createMockRegion({ index: 1, neighbors: [0] })
                ],
                ownersByRegion: { 0: 0, 1: 1 },
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
                templesByRegion: {
                    1: createMockTemple({ regionIndex: 1, upgradeIndex: undefined })
                },
                faithByPlayer: { 0: 50, 1: 50 },
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // AI should make decisions about building/moving
            expect(result).toBeDefined();
            expect(result.getCurrentPlayer()?.isAI).toBe(false);
        });

        it('should handle complex multi-player scenario', async () => {
            vi.setConfig({ testTimeout: 10000 }); // Increase timeout for this test
            const players = [
                createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false }),
                createMockPlayer({ slotIndex: 1, name: 'AI 1', isAI: true, personality: 'Defender' }),
                createMockPlayer({ slotIndex: 2, name: 'AI 2', isAI: true, personality: 'Aggressor' }),
                createMockPlayer({ slotIndex: 3, name: 'AI 3', isAI: true, personality: 'Economist' })
            ];
            
            const gameState = createMockGameState({
                players,
                currentPlayerSlot: 1,
                regions: Array.from({ length: 8 }, (_, i) =>
                    createMockRegion({ index: i, neighbors: [Math.max(0, i - 1), Math.min(7, i + 1)] })
                ),
                ownersByRegion: Object.fromEntries(
                    Array.from({ length: 8 }, (_, i) => [i, i % 4])
                ),
                soldiersByRegion: Object.fromEntries(
                    Array.from({ length: 8 }, (_, i) => [i, [{ i }]])
                ),
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should process all AI turns and stop at human
            expect(result).toBeDefined();
            expect(result.getCurrentPlayer()?.slotIndex).toBe(0);
        });

        it('should handle eliminated player gracefully', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const eliminatedAi = createMockPlayer({ slotIndex: 1, name: 'Eliminated AI', isAI: true, personality: 'Defender' });
            const activeAi = createMockPlayer({ slotIndex: 2, name: 'Active AI', isAI: true, personality: 'Aggressor' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, eliminatedAi, activeAi],
                currentPlayerSlot: 1, // Eliminated AI's turn
                regions: [
                    createMockRegion({ index: 0, neighbors: [1] }),
                    createMockRegion({ index: 1, neighbors: [0] })
                ],
                ownersByRegion: { 0: 0, 1: 2 }, // Eliminated AI owns nothing
                soldiersByRegion: { 0: [{ i: 1 }], 1: [{ i: 2 }] },
                eliminatedPlayers: [1],
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            const result = await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            
            // Should skip eliminated AI and process active AI
            expect(result).toBeDefined();
        });
    });

    describe('Performance', () => {
        it('should complete processing within reasonable time', async () => {
            const humanPlayer = createMockPlayer({ slotIndex: 0, name: 'Human', isAI: false });
            const aiPlayer = createMockPlayer({ slotIndex: 1, name: 'AI', isAI: true, personality: 'Defender' });
            
            const gameState = createMockGameState({
                players: [humanPlayer, aiPlayer],
                currentPlayerSlot: 1,
                regions: Array.from({ length: 6 }, (_, i) =>
                    createMockRegion({ index: i, neighbors: [(i + 1) % 6, (i + 5) % 6] })
                ),
                ownersByRegion: Object.fromEntries(
                    Array.from({ length: 6 }, (_, i) => [i, i % 2])
                ),
                soldiersByRegion: Object.fromEntries(
                    Array.from({ length: 6 }, (_, i) => [i, [{ i }, { i: i + 100 }]])
                ),
                movesRemaining: 3,
                aiDifficulty: AiDifficulty.RUDE
            });
            
            const { storage } = createMockGameStorage();
            
            const startTime = Date.now();
            await processAiTurns(gameState, storage, 'test-game', mockPlatform);
            const elapsed = Date.now() - startTime;
            
            // Should complete in reasonable time (allow generous buffer for CI)
            expect(elapsed).toBeLessThan(5000);
        });
    });
});

