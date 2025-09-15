/**
 * Svelte store for managing multiplayer state
 * This is the reusable multiplayer framework part
 */
import { writable, derived } from 'svelte/store';
import { multiplayerActions } from './multiplayerActions';
import {
    type MultiplayerState,
    type GameUpdateEvent,
    initialState
} from './multiplayerTypes';

// Core multiplayer store
export const multiplayerState = writable<MultiplayerState>(initialState);

// Game update events stream
export const gameUpdates = writable<GameUpdateEvent | null>(null);

export const isConnected = derived(
    multiplayerState,
    $state => $state.isConnected
);

export const connectionStatus = derived(
    multiplayerState,
    $state => $state.connectionStatus
);

export const currentGameId = derived(
    multiplayerState,
    $state => $state.gameId
);

// Re-export actions and types for convenience
export { multiplayerActions };
export * from './multiplayerTypes';
