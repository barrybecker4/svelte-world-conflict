/**
 * Unit tests for gameStateStore
 * Tests game state management and derived stores
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type {
    GalacticGameStateData,
    Planet,
    Armada,
    Player,
    Position,
} from '$lib/game/entities/gameTypes';
import {
    gameState,
    selectedPlanetId,
    currentPlayerId,
    isConnected,
    isLoading,
    errorMessage,
    currentPlayer,
    ownedPlanets,
    totalShips,
    totalResources,
    myArmadas,
    timeRemaining,
    isGameComplete,
    selectedPlanet,
    updateGameState,
    clearGameStores,
} from './gameStateStore';

/**
 * Helper to create a mock position
 */
function createMockPosition(overrides?: Partial<Position>): Position {
    return {
        x: 100,
        y: 200,
        ...overrides,
    };
}

/**
 * Helper to create a mock player
 */
function createMockPlayer(overrides?: Partial<Player>): Player {
    return {
        slotIndex: 0,
        name: 'Test Player',
        color: '#ff0000',
        isAI: false,
        ...overrides,
    };
}

/**
 * Helper to create a mock planet
 */
function createMockPlanet(overrides?: Partial<Planet>): Planet {
    return {
        id: 1,
        name: 'Test Planet',
        position: createMockPosition(),
        volume: 50,
        ownerId: 0,
        ships: 10,
        resources: 100,
        ...overrides,
    };
}

/**
 * Helper to create a mock armada
 */
function createMockArmada(overrides?: Partial<Armada>): Armada {
    const now = Date.now();
    return {
        id: 'armada-1',
        ownerId: 0,
        ships: 5,
        sourcePlanetId: 1,
        destinationPlanetId: 2,
        departureTime: now - 1000,
        arrivalTime: now + 5000,
        ...overrides,
    };
}

/**
 * Helper to create a mock game state
 */
function createMockGameState(overrides?: Partial<GalacticGameStateData>): GalacticGameStateData {
    const now = Date.now();
    return {
        gameId: 'test-game-1',
        status: 'ACTIVE',
        startTime: now - 60000, // 1 minute ago
        durationMinutes: 30,
        armadaSpeed: 1,
        productionRate: 1,
        planets: [createMockPlanet()],
        players: [createMockPlayer()],
        armadas: [],
        eventQueue: [],
        resourcesByPlayer: { 0: 100 },
        recentBattleReplays: [],
        recentReinforcementEvents: [],
        recentConquestEvents: [],
        recentPlayerEliminationEvents: [],
        ...overrides,
    };
}

describe('gameStateStore', () => {
    beforeEach(() => {
        // Clear all stores before each test
        clearGameStores();
    });

    describe('writable stores', () => {
        describe('gameState', () => {
            it('should initialize as null', () => {
                expect(get(gameState)).toBeNull();
            });

            it('should update game state', () => {
                const state = createMockGameState();
                gameState.set(state);

                expect(get(gameState)).toEqual(state);
            });

            it('should allow setting to null', () => {
                const state = createMockGameState();
                gameState.set(state);
                gameState.set(null);

                expect(get(gameState)).toBeNull();
            });
        });

        describe('selectedPlanetId', () => {
            it('should initialize as null', () => {
                expect(get(selectedPlanetId)).toBeNull();
            });

            it('should update selected planet ID', () => {
                selectedPlanetId.set(5);
                expect(get(selectedPlanetId)).toBe(5);
            });

            it('should allow setting to null', () => {
                selectedPlanetId.set(5);
                selectedPlanetId.set(null);
                expect(get(selectedPlanetId)).toBeNull();
            });
        });

        describe('currentPlayerId', () => {
            it('should initialize as null', () => {
                expect(get(currentPlayerId)).toBeNull();
            });

            it('should update current player ID', () => {
                currentPlayerId.set(2);
                expect(get(currentPlayerId)).toBe(2);
            });

            it('should allow setting to null', () => {
                currentPlayerId.set(2);
                currentPlayerId.set(null);
                expect(get(currentPlayerId)).toBeNull();
            });
        });

        describe('isConnected', () => {
            it('should initialize as false', () => {
                expect(get(isConnected)).toBe(false);
            });

            it('should update connection status', () => {
                isConnected.set(true);
                expect(get(isConnected)).toBe(true);

                isConnected.set(false);
                expect(get(isConnected)).toBe(false);
            });
        });

        describe('isLoading', () => {
            it('should initialize as false', () => {
                expect(get(isLoading)).toBe(false);
            });

            it('should update loading status', () => {
                isLoading.set(true);
                expect(get(isLoading)).toBe(true);

                isLoading.set(false);
                expect(get(isLoading)).toBe(false);
            });
        });

        describe('errorMessage', () => {
            it('should initialize as null', () => {
                expect(get(errorMessage)).toBeNull();
            });

            it('should update error message', () => {
                errorMessage.set('Test error');
                expect(get(errorMessage)).toBe('Test error');
            });

            it('should allow setting to null', () => {
                errorMessage.set('Test error');
                errorMessage.set(null);
                expect(get(errorMessage)).toBeNull();
            });
        });
    });

    describe('derived stores', () => {
        describe('currentPlayer', () => {
            it('should return null when gameState is null', () => {
                expect(get(currentPlayer)).toBeNull();
            });

            it('should return null when currentPlayerId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(null);

                expect(get(currentPlayer)).toBeNull();
            });

            it('should return the current player when found', () => {
                const player1 = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
                const player2 = createMockPlayer({ slotIndex: 1, name: 'Player 2' });
                const state = createMockGameState({
                    players: [player1, player2],
                });

                gameState.set(state);
                currentPlayerId.set(1);

                expect(get(currentPlayer)).toEqual(player2);
            });

            it('should return null when player not found', () => {
                const player1 = createMockPlayer({ slotIndex: 0 });
                const state = createMockGameState({
                    players: [player1],
                });

                gameState.set(state);
                currentPlayerId.set(999);

                expect(get(currentPlayer)).toBeNull();
            });
        });

        describe('ownedPlanets', () => {
            it('should return empty array when gameState is null', () => {
                expect(get(ownedPlanets)).toEqual([]);
            });

            it('should return empty array when currentPlayerId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(null);

                expect(get(ownedPlanets)).toEqual([]);
            });

            it('should return planets owned by current player', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0 });
                const planet2 = createMockPlanet({ id: 2, ownerId: 0 });
                const planet3 = createMockPlanet({ id: 3, ownerId: 1 });
                const state = createMockGameState({
                    planets: [planet1, planet2, planet3],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                const owned = get(ownedPlanets);
                expect(owned).toHaveLength(2);
                expect(owned).toContainEqual(planet1);
                expect(owned).toContainEqual(planet2);
                expect(owned).not.toContainEqual(planet3);
            });

            it('should return empty array when player owns no planets', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 1 });
                const state = createMockGameState({
                    planets: [planet1],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(ownedPlanets)).toEqual([]);
            });

            it('should exclude neutral planets (ownerId null)', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0 });
                const planet2 = createMockPlanet({ id: 2, ownerId: null });
                const state = createMockGameState({
                    planets: [planet1, planet2],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                const owned = get(ownedPlanets);
                expect(owned).toHaveLength(1);
                expect(owned[0].id).toBe(1);
            });
        });

        describe('totalShips', () => {
            it('should return 0 when gameState is null', () => {
                expect(get(totalShips)).toBe(0);
            });

            it('should return 0 when currentPlayerId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(null);

                expect(get(totalShips)).toBe(0);
            });

            it('should sum ships from owned planets', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0, ships: 10 });
                const planet2 = createMockPlanet({ id: 2, ownerId: 0, ships: 20 });
                const planet3 = createMockPlanet({ id: 3, ownerId: 1, ships: 30 });
                const state = createMockGameState({
                    planets: [planet1, planet2, planet3],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalShips)).toBe(30);
            });

            it('should sum ships from armadas', () => {
                const armada1 = createMockArmada({ id: 'a1', ownerId: 0, ships: 5 });
                const armada2 = createMockArmada({ id: 'a2', ownerId: 0, ships: 10 });
                const armada3 = createMockArmada({ id: 'a3', ownerId: 1, ships: 15 });
                const state = createMockGameState({
                    planets: [], // No planets to isolate armada ships
                    armadas: [armada1, armada2, armada3],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalShips)).toBe(15);
            });

            it('should sum ships from both planets and armadas', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0, ships: 10 });
                const armada1 = createMockArmada({ id: 'a1', ownerId: 0, ships: 5 });
                const state = createMockGameState({
                    planets: [planet1],
                    armadas: [armada1],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalShips)).toBe(15);
            });

            it('should return 0 when player has no ships', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 1, ships: 10 });
                const state = createMockGameState({
                    planets: [planet1],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalShips)).toBe(0);
            });
        });

        describe('totalResources', () => {
            it('should return 0 when gameState is null', () => {
                expect(get(totalResources)).toBe(0);
            });

            it('should return 0 when currentPlayerId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(null);

                expect(get(totalResources)).toBe(0);
            });

            it('should sum resources from owned planets', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0, resources: 50 });
                const planet2 = createMockPlanet({ id: 2, ownerId: 0, resources: 75 });
                const planet3 = createMockPlanet({ id: 3, ownerId: 1, resources: 100 });
                const state = createMockGameState({
                    planets: [planet1, planet2, planet3],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalResources)).toBe(125);
            });

            it('should return 0 when player owns no planets', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 1, resources: 100 });
                const state = createMockGameState({
                    planets: [planet1],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalResources)).toBe(0);
            });

            it('should exclude neutral planets', () => {
                const planet1 = createMockPlanet({ id: 1, ownerId: 0, resources: 50 });
                const planet2 = createMockPlanet({ id: 2, ownerId: null, resources: 100 });
                const state = createMockGameState({
                    planets: [planet1, planet2],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(totalResources)).toBe(50);
            });
        });

        describe('myArmadas', () => {
            it('should return empty array when gameState is null', () => {
                expect(get(myArmadas)).toEqual([]);
            });

            it('should return empty array when currentPlayerId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(null);

                expect(get(myArmadas)).toEqual([]);
            });

            it('should return armadas owned by current player', () => {
                const armada1 = createMockArmada({ id: 'a1', ownerId: 0 });
                const armada2 = createMockArmada({ id: 'a2', ownerId: 0 });
                const armada3 = createMockArmada({ id: 'a3', ownerId: 1 });
                const state = createMockGameState({
                    armadas: [armada1, armada2, armada3],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                const armadas = get(myArmadas);
                expect(armadas).toHaveLength(2);
                expect(armadas).toContainEqual(armada1);
                expect(armadas).toContainEqual(armada2);
                expect(armadas).not.toContainEqual(armada3);
            });

            it('should return empty array when player has no armadas', () => {
                const armada1 = createMockArmada({ id: 'a1', ownerId: 1 });
                const state = createMockGameState({
                    armadas: [armada1],
                });

                gameState.set(state);
                currentPlayerId.set(0);

                expect(get(myArmadas)).toEqual([]);
            });
        });

        describe('timeRemaining', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('should return 0 when gameState is null', () => {
                expect(get(timeRemaining)).toBe(0);
            });

            it('should calculate time remaining correctly', () => {
                const now = Date.now();
                const startTime = now - 60000; // 1 minute ago
                const durationMinutes = 30;
                const state = createMockGameState({
                    startTime,
                    durationMinutes,
                });

                vi.setSystemTime(now);
                gameState.set(state);

                const expected = durationMinutes * 60 * 1000 - 60000; // 29 minutes
                expect(get(timeRemaining)).toBe(expected);
            });

            it('should return 0 when time has expired', () => {
                const now = Date.now();
                const startTime = now - 2000000; // Way in the past
                const durationMinutes = 30;
                const state = createMockGameState({
                    startTime,
                    durationMinutes,
                });

                vi.setSystemTime(now);
                gameState.set(state);

                expect(get(timeRemaining)).toBe(0);
            });

            it('should update as time progresses', () => {
                const now = Date.now();
                const startTime = now;
                const durationMinutes = 30;
                const state = createMockGameState({
                    startTime,
                    durationMinutes,
                });

                vi.setSystemTime(now);
                gameState.set(state);

                const initial = get(timeRemaining);
                expect(initial).toBe(durationMinutes * 60 * 1000);

                // Advance time by 1 minute
                vi.advanceTimersByTime(60000);
                const after = get(timeRemaining);
                expect(after).toBe(durationMinutes * 60 * 1000 - 60000);
            });
        });

        describe('isGameComplete', () => {
            it('should return false when gameState is null', () => {
                expect(get(isGameComplete)).toBe(false);
            });

            it('should return true when status is COMPLETED', () => {
                const state = createMockGameState({
                    status: 'COMPLETED',
                });

                gameState.set(state);
                expect(get(isGameComplete)).toBe(true);
            });

            it('should return false when status is ACTIVE', () => {
                const state = createMockGameState({
                    status: 'ACTIVE',
                });

                gameState.set(state);
                expect(get(isGameComplete)).toBe(false);
            });

            it('should return false when status is WAITING', () => {
                const state = createMockGameState({
                    status: 'WAITING',
                });

                gameState.set(state);
                expect(get(isGameComplete)).toBe(false);
            });
        });

        describe('selectedPlanet', () => {
            it('should return null when gameState is null', () => {
                expect(get(selectedPlanet)).toBeNull();
            });

            it('should return null when selectedPlanetId is null', () => {
                const state = createMockGameState();
                gameState.set(state);
                selectedPlanetId.set(null);

                expect(get(selectedPlanet)).toBeNull();
            });

            it('should return the selected planet when found', () => {
                const planet1 = createMockPlanet({ id: 1, name: 'Planet 1' });
                const planet2 = createMockPlanet({ id: 2, name: 'Planet 2' });
                const state = createMockGameState({
                    planets: [planet1, planet2],
                });

                gameState.set(state);
                selectedPlanetId.set(2);

                expect(get(selectedPlanet)).toEqual(planet2);
            });

            it('should return null when planet not found', () => {
                const planet1 = createMockPlanet({ id: 1 });
                const state = createMockGameState({
                    planets: [planet1],
                });

                gameState.set(state);
                selectedPlanetId.set(999);

                expect(get(selectedPlanet)).toBeNull();
            });
        });
    });

    describe('update functions', () => {
        describe('updateGameState', () => {
            it('should update the gameState store', () => {
                const state = createMockGameState();
                updateGameState(state);

                expect(get(gameState)).toEqual(state);
            });

            it('should replace existing game state', () => {
                const state1 = createMockGameState({ gameId: 'game-1' });
                const state2 = createMockGameState({ gameId: 'game-2' });

                updateGameState(state1);
                expect(get(gameState)?.gameId).toBe('game-1');

                updateGameState(state2);
                expect(get(gameState)?.gameId).toBe('game-2');
            });
        });

        describe('clearGameStores', () => {
            it('should clear all stores to their initial state', () => {
                // Set all stores to non-default values
                const state = createMockGameState();
                gameState.set(state);
                selectedPlanetId.set(5);
                currentPlayerId.set(2);
                isConnected.set(true);
                isLoading.set(true);
                errorMessage.set('Test error');

                // Clear all stores
                clearGameStores();

                expect(get(gameState)).toBeNull();
                expect(get(selectedPlanetId)).toBeNull();
                expect(get(currentPlayerId)).toBeNull();
                expect(get(isConnected)).toBe(false);
                expect(get(isLoading)).toBe(false);
                expect(get(errorMessage)).toBeNull();
            });

            it('should reset derived stores indirectly', () => {
                const state = createMockGameState();
                gameState.set(state);
                currentPlayerId.set(0);
                selectedPlanetId.set(1);

                // Verify derived stores have values
                expect(get(currentPlayer)).not.toBeNull();
                expect(get(ownedPlanets)).not.toEqual([]);
                expect(get(selectedPlanet)).not.toBeNull();

                // Clear stores
                clearGameStores();

                // Derived stores should reflect cleared state
                expect(get(currentPlayer)).toBeNull();
                expect(get(ownedPlanets)).toEqual([]);
                expect(get(selectedPlanet)).toBeNull();
            });
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete game state workflow', () => {
            // Initialize game
            const player1 = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
            const player2 = createMockPlayer({ slotIndex: 1, name: 'Player 2' });
            const planet1 = createMockPlanet({ id: 1, ownerId: 0, ships: 10, resources: 50 });
            const planet2 = createMockPlanet({ id: 2, ownerId: 0, ships: 20, resources: 75 });
            const armada1 = createMockArmada({ id: 'a1', ownerId: 0, ships: 5 });

            const state = createMockGameState({
                players: [player1, player2],
                planets: [planet1, planet2],
                armadas: [armada1],
            });

            updateGameState(state);
            currentPlayerId.set(0);
            selectedPlanetId.set(1);
            isConnected.set(true);

            // Verify all stores
            expect(get(gameState)).toEqual(state);
            expect(get(currentPlayer)).toEqual(player1);
            expect(get(ownedPlanets)).toHaveLength(2);
            expect(get(totalShips)).toBe(35); // 10 + 20 + 5
            expect(get(totalResources)).toBe(125); // 50 + 75
            expect(get(myArmadas)).toHaveLength(1);
            expect(get(selectedPlanet)).toEqual(planet1);
            expect(get(isConnected)).toBe(true);

            // Clear and verify
            clearGameStores();
            expect(get(gameState)).toBeNull();
            expect(get(currentPlayer)).toBeNull();
            expect(get(ownedPlanets)).toEqual([]);
        });

        it('should handle player switching', () => {
            const player1 = createMockPlayer({ slotIndex: 0, name: 'Player 1' });
            const player2 = createMockPlayer({ slotIndex: 1, name: 'Player 2' });
            const planet1 = createMockPlanet({ id: 1, ownerId: 0, ships: 10 });
            const planet2 = createMockPlanet({ id: 2, ownerId: 1, ships: 20 });

            const state = createMockGameState({
                players: [player1, player2],
                planets: [planet1, planet2],
            });

            gameState.set(state);

            // Switch to player 1
            currentPlayerId.set(0);
            expect(get(currentPlayer)).toEqual(player1);
            expect(get(ownedPlanets)).toContainEqual(planet1);
            expect(get(totalShips)).toBe(10);

            // Switch to player 2
            currentPlayerId.set(1);
            expect(get(currentPlayer)).toEqual(player2);
            expect(get(ownedPlanets)).toContainEqual(planet2);
            expect(get(totalShips)).toBe(20);
        });

        it('should handle planet selection changes', () => {
            const planet1 = createMockPlanet({ id: 1, name: 'Planet 1' });
            const planet2 = createMockPlanet({ id: 2, name: 'Planet 2' });
            const state = createMockGameState({
                planets: [planet1, planet2],
            });

            gameState.set(state);

            // Select planet 1
            selectedPlanetId.set(1);
            expect(get(selectedPlanet)).toEqual(planet1);

            // Select planet 2
            selectedPlanetId.set(2);
            expect(get(selectedPlanet)).toEqual(planet2);

            // Deselect
            selectedPlanetId.set(null);
            expect(get(selectedPlanet)).toBeNull();
        });
    });
});

