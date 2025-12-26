/**
 * Unit tests for clientStorage
 * Tests localStorage wrapper functions with Galactic Conflict prefix
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameCreatorInfo as BaseGameCreatorInfo } from 'multiplayer-framework/shared';

// Create mock storage functions using vi.hoisted so they're available in the mock factory
const { mockLoadPlayerName, mockSavePlayerName, mockSaveGameCreator, mockLoadGameCreator, mockRemoveGameCreator } = vi.hoisted(() => ({
    mockLoadPlayerName: vi.fn(),
    mockSavePlayerName: vi.fn(),
    mockSaveGameCreator: vi.fn(),
    mockLoadGameCreator: vi.fn(),
    mockRemoveGameCreator: vi.fn(),
}));

// Mock createClientStorage from the framework
vi.mock('multiplayer-framework/shared', () => ({
    createClientStorage: vi.fn((options: { prefix: string }) => {
        // Verify the prefix is correct
        expect(options.prefix).toBe('gc_');
        return {
            loadPlayerName: mockLoadPlayerName,
            savePlayerName: mockSavePlayerName,
            saveGameCreator: mockSaveGameCreator,
            loadGameCreator: mockLoadGameCreator,
            removeGameCreator: mockRemoveGameCreator,
        };
    }),
}));

// Import after mock is set up
import {
    loadPlayerName,
    savePlayerName,
    saveGameCreator,
    loadGameCreator,
    clearGameCreator,
    type GameCreatorInfo,
} from './clientStorage';

describe('clientStorage', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        mockLoadPlayerName.mockClear();
        mockSavePlayerName.mockClear();
        mockSaveGameCreator.mockClear();
        mockLoadGameCreator.mockClear();
        mockRemoveGameCreator.mockClear();
    });

    describe('loadPlayerName', () => {
        it('should call storage.loadPlayerName and return the result', () => {
            const expectedName = 'Test Player';
            mockLoadPlayerName.mockReturnValue(expectedName);

            const result = loadPlayerName();

            expect(mockLoadPlayerName).toHaveBeenCalledOnce();
            expect(result).toBe(expectedName);
        });

        it('should return null when storage returns null', () => {
            mockLoadPlayerName.mockReturnValue(null);

            const result = loadPlayerName();

            expect(mockLoadPlayerName).toHaveBeenCalledOnce();
            expect(result).toBeNull();
        });
    });

    describe('savePlayerName', () => {
        it('should call storage.savePlayerName with the provided name', () => {
            const playerName = 'New Player';

            savePlayerName(playerName);

            expect(mockSavePlayerName).toHaveBeenCalledOnce();
            expect(mockSavePlayerName).toHaveBeenCalledWith(playerName);
        });

        it('should handle empty string', () => {
            savePlayerName('');

            expect(mockSavePlayerName).toHaveBeenCalledOnce();
            expect(mockSavePlayerName).toHaveBeenCalledWith('');
        });

        it('should handle names with whitespace', () => {
            const playerName = '  Player With Spaces  ';

            savePlayerName(playerName);

            expect(mockSavePlayerName).toHaveBeenCalledOnce();
            expect(mockSavePlayerName).toHaveBeenCalledWith(playerName);
        });
    });

    describe('saveGameCreator', () => {
        it('should call storage.saveGameCreator with gameId and info', () => {
            const gameId = 'test-game-123';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator',
                isCreator: true,
            };

            saveGameCreator(gameId, creatorInfo);

            expect(mockSaveGameCreator).toHaveBeenCalledOnce();
            expect(mockSaveGameCreator).toHaveBeenCalledWith(gameId, creatorInfo);
        });

        it('should handle GameCreatorInfo with isCreator false', () => {
            const gameId = 'test-game-456';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-2',
                playerSlotIndex: 1,
                playerName: 'Not Creator',
                isCreator: false,
            };

            saveGameCreator(gameId, creatorInfo);

            expect(mockSaveGameCreator).toHaveBeenCalledOnce();
            expect(mockSaveGameCreator).toHaveBeenCalledWith(gameId, creatorInfo);
        });

        it('should handle different game IDs', () => {
            const gameId1 = 'game-1';
            const gameId2 = 'game-2';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator',
                isCreator: true,
            };

            saveGameCreator(gameId1, creatorInfo);
            saveGameCreator(gameId2, creatorInfo);

            expect(mockSaveGameCreator).toHaveBeenCalledTimes(2);
            expect(mockSaveGameCreator).toHaveBeenNthCalledWith(1, gameId1, creatorInfo);
            expect(mockSaveGameCreator).toHaveBeenNthCalledWith(2, gameId2, creatorInfo);
        });
    });

    describe('loadGameCreator', () => {
        it('should call storage.loadGameCreator and return the result', () => {
            const gameId = 'test-game-123';
            const expectedInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator',
                isCreator: true,
            };
            mockLoadGameCreator.mockReturnValue(expectedInfo);

            const result = loadGameCreator(gameId);

            expect(mockLoadGameCreator).toHaveBeenCalledOnce();
            expect(mockLoadGameCreator).toHaveBeenCalledWith(gameId);
            expect(result).toEqual(expectedInfo);
        });

        it('should return null when storage returns null', () => {
            const gameId = 'non-existent-game';
            mockLoadGameCreator.mockReturnValue(null);

            const result = loadGameCreator(gameId);

            expect(mockLoadGameCreator).toHaveBeenCalledOnce();
            expect(mockLoadGameCreator).toHaveBeenCalledWith(gameId);
            expect(result).toBeNull();
        });

        it('should handle GameCreatorInfo with isCreator false', () => {
            const gameId = 'test-game-456';
            const expectedInfo: GameCreatorInfo = {
                playerId: 'player-2',
                playerSlotIndex: 1,
                playerName: 'Not Creator',
                isCreator: false,
            };
            mockLoadGameCreator.mockReturnValue(expectedInfo);

            const result = loadGameCreator(gameId);

            expect(result).toEqual(expectedInfo);
            expect(result?.isCreator).toBe(false);
        });

        it('should handle different game IDs', () => {
            const gameId1 = 'game-1';
            const gameId2 = 'game-2';
            const info1: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator 1',
                isCreator: true,
            };
            const info2: GameCreatorInfo = {
                playerId: 'player-2',
                playerSlotIndex: 1,
                playerName: 'Creator 2',
                isCreator: true,
            };

            mockLoadGameCreator.mockImplementation((id: string) => {
                if (id === gameId1) return info1;
                if (id === gameId2) return info2;
                return null;
            });

            const result1 = loadGameCreator(gameId1);
            const result2 = loadGameCreator(gameId2);

            expect(mockLoadGameCreator).toHaveBeenCalledTimes(2);
            expect(result1).toEqual(info1);
            expect(result2).toEqual(info2);
        });
    });

    describe('clearGameCreator', () => {
        it('should call storage.removeGameCreator with the gameId', () => {
            const gameId = 'test-game-123';

            clearGameCreator(gameId);

            expect(mockRemoveGameCreator).toHaveBeenCalledOnce();
            expect(mockRemoveGameCreator).toHaveBeenCalledWith(gameId);
        });

        it('should handle different game IDs', () => {
            const gameId1 = 'game-1';
            const gameId2 = 'game-2';

            clearGameCreator(gameId1);
            clearGameCreator(gameId2);

            expect(mockRemoveGameCreator).toHaveBeenCalledTimes(2);
            expect(mockRemoveGameCreator).toHaveBeenNthCalledWith(1, gameId1);
            expect(mockRemoveGameCreator).toHaveBeenNthCalledWith(2, gameId2);
        });

        it('should handle clearing non-existent game', () => {
            const gameId = 'non-existent-game';

            clearGameCreator(gameId);

            expect(mockRemoveGameCreator).toHaveBeenCalledOnce();
            expect(mockRemoveGameCreator).toHaveBeenCalledWith(gameId);
        });
    });

    describe('integration scenarios', () => {
        it('should handle save and load workflow', () => {
            const gameId = 'test-game-123';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator',
                isCreator: true,
            };

            // Save
            saveGameCreator(gameId, creatorInfo);
            expect(mockSaveGameCreator).toHaveBeenCalledWith(gameId, creatorInfo);

            // Load
            mockLoadGameCreator.mockReturnValue(creatorInfo);
            const loaded = loadGameCreator(gameId);
            expect(loaded).toEqual(creatorInfo);
            expect(loaded?.isCreator).toBe(true);
        });

        it('should handle save, load, and clear workflow', () => {
            const gameId = 'test-game-456';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-2',
                playerSlotIndex: 1,
                playerName: 'Creator',
                isCreator: false,
            };

            // Save
            saveGameCreator(gameId, creatorInfo);

            // Load
            mockLoadGameCreator.mockReturnValue(creatorInfo);
            const loaded = loadGameCreator(gameId);
            expect(loaded).toEqual(creatorInfo);

            // Clear
            clearGameCreator(gameId);
            expect(mockRemoveGameCreator).toHaveBeenCalledWith(gameId);

            // Load after clear
            mockLoadGameCreator.mockReturnValue(null);
            const cleared = loadGameCreator(gameId);
            expect(cleared).toBeNull();
        });

        it('should handle multiple games with different creators', () => {
            const gameId1 = 'game-1';
            const gameId2 = 'game-2';
            const creator1: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator 1',
                isCreator: true,
            };
            const creator2: GameCreatorInfo = {
                playerId: 'player-2',
                playerSlotIndex: 1,
                playerName: 'Creator 2',
                isCreator: true,
            };

            saveGameCreator(gameId1, creator1);
            saveGameCreator(gameId2, creator2);

            mockLoadGameCreator.mockImplementation((id: string) => {
                if (id === gameId1) return creator1;
                if (id === gameId2) return creator2;
                return null;
            });

            const loaded1 = loadGameCreator(gameId1);
            const loaded2 = loadGameCreator(gameId2);

            expect(loaded1).toEqual(creator1);
            expect(loaded2).toEqual(creator2);
            expect(loaded1?.isCreator).toBe(true);
            expect(loaded2?.isCreator).toBe(true);
        });
    });

    describe('GameCreatorInfo type extension', () => {
        it('should accept GameCreatorInfo with isCreator property', () => {
            const gameId = 'test-game';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Creator',
                isCreator: true,
            };

            // TypeScript should accept this
            saveGameCreator(gameId, creatorInfo);
            expect(mockSaveGameCreator).toHaveBeenCalledWith(gameId, creatorInfo);

            // Verify isCreator is part of the type
            expect(creatorInfo.isCreator).toBe(true);
        });

        it('should handle isCreator as false', () => {
            const gameId = 'test-game';
            const creatorInfo: GameCreatorInfo = {
                playerId: 'player-1',
                playerSlotIndex: 0,
                playerName: 'Not Creator',
                isCreator: false,
            };

            saveGameCreator(gameId, creatorInfo);
            mockLoadGameCreator.mockReturnValue(creatorInfo);

            const loaded = loadGameCreator(gameId);
            expect(loaded?.isCreator).toBe(false);
        });
    });
});

