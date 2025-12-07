/**
 * Svelte store for game state
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { GalacticGameStateData, Planet, Armada, Battle, Player } from '$lib/game/entities/gameTypes';

/**
 * Main game state store
 */
export const gameState: Writable<GalacticGameStateData | null> = writable(null);

/**
 * Selected planet store
 */
export const selectedPlanetId: Writable<number | null> = writable(null);

/**
 * Current player slot index
 */
export const currentPlayerId: Writable<number | null> = writable(null);

/**
 * Connection status
 */
export const isConnected: Writable<boolean> = writable(false);

/**
 * Loading state
 */
export const isLoading: Writable<boolean> = writable(false);

/**
 * Error message
 */
export const errorMessage: Writable<string | null> = writable(null);

// ==================== DERIVED STORES ====================

/**
 * Current player object
 */
export const currentPlayer: Readable<Player | null> = derived(
    [gameState, currentPlayerId],
    ([$gameState, $currentPlayerId]) => {
        if (!$gameState || $currentPlayerId === null) return null;
        return $gameState.players.find(p => p.slotIndex === $currentPlayerId) || null;
    }
);

/**
 * Planets owned by current player
 */
export const ownedPlanets: Readable<Planet[]> = derived(
    [gameState, currentPlayerId],
    ([$gameState, $currentPlayerId]) => {
        if (!$gameState || $currentPlayerId === null) return [];
        return $gameState.planets.filter(p => p.ownerId === $currentPlayerId);
    }
);

/**
 * Total ships for current player
 */
export const totalShips: Readable<number> = derived(
    [gameState, currentPlayerId],
    ([$gameState, $currentPlayerId]) => {
        if (!$gameState || $currentPlayerId === null) return 0;
        
        const planetShips = $gameState.planets
            .filter(p => p.ownerId === $currentPlayerId)
            .reduce((sum, p) => sum + p.ships, 0);
            
        const armadaShips = $gameState.armadas
            .filter(a => a.ownerId === $currentPlayerId)
            .reduce((sum, a) => sum + a.ships, 0);
            
        return planetShips + armadaShips;
    }
);

/**
 * Total resources for current player
 */
export const totalResources: Readable<number> = derived(
    [gameState, currentPlayerId],
    ([$gameState, $currentPlayerId]) => {
        if (!$gameState || $currentPlayerId === null) return 0;
        return $gameState.planets
            .filter(p => p.ownerId === $currentPlayerId)
            .reduce((sum, p) => sum + p.resources, 0);
    }
);

/**
 * Current player's armadas in transit
 */
export const myArmadas: Readable<Armada[]> = derived(
    [gameState, currentPlayerId],
    ([$gameState, $currentPlayerId]) => {
        if (!$gameState || $currentPlayerId === null) return [];
        return $gameState.armadas.filter(a => a.ownerId === $currentPlayerId);
    }
);

/**
 * Active battles
 */
export const activeBattles: Readable<Battle[]> = derived(
    gameState,
    ($gameState) => {
        if (!$gameState) return [];
        return $gameState.activeBattles.filter(b => b.status === 'active');
    }
);

/**
 * Game time remaining in milliseconds
 */
export const timeRemaining: Readable<number> = derived(
    gameState,
    ($gameState) => {
        if (!$gameState) return 0;
        const endTime = $gameState.startTime + $gameState.durationMinutes * 60 * 1000;
        return Math.max(0, endTime - Date.now());
    }
);

/**
 * Is game complete
 */
export const isGameComplete: Readable<boolean> = derived(
    gameState,
    ($gameState) => {
        if (!$gameState) return false;
        return $gameState.status === 'COMPLETED';
    }
);

/**
 * Selected planet object
 */
export const selectedPlanet: Readable<Planet | null> = derived(
    [gameState, selectedPlanetId],
    ([$gameState, $selectedPlanetId]) => {
        if (!$gameState || $selectedPlanetId === null) return null;
        return $gameState.planets.find(p => p.id === $selectedPlanetId) || null;
    }
);

// ==================== UPDATE FUNCTIONS ====================

/**
 * Update game state from server
 */
export function updateGameState(newState: GalacticGameStateData): void {
    gameState.set(newState);
}

/**
 * Clear all stores (on game exit)
 */
export function clearGameStores(): void {
    gameState.set(null);
    selectedPlanetId.set(null);
    currentPlayerId.set(null);
    isConnected.set(false);
    isLoading.set(false);
    errorMessage.set(null);
}

