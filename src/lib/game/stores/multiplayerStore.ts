/**
 * Svelte store for managing multiplayer state
 * This is the reusable multiplayer framework part
 */
import { writable, derived } from 'svelte/store';
import { GameWebSocketClient } from '../websocket/client.js';

// Types for multiplayer state
export interface MultiplayerState {
    isConnected: boolean;
    gameId: string | null;
    connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
    lastError: string | null;
    playersOnline: number;
}

export interface GameUpdateEvent {
    type: 'gameUpdate' | 'playerJoined' | 'playerLeft';
    gameId: string;
    data: any;
    timestamp: number;
}

// Initial state
const initialState: MultiplayerState = {
    isConnected: false,
    gameId: null,
    connectionStatus: 'disconnected',
    lastError: null,
    playersOnline: 0
};

// Core multiplayer store
export const multiplayerState = writable<MultiplayerState>(initialState);

// WebSocket client instance
let wsClient: GameWebSocketClient | null = null;

// Game update events stream
export const gameUpdates = writable<GameUpdateEvent | null>(null);

// Derived stores for convenience
export const isConnected = derived(multiplayerState, $state => $state.isConnected);
export const connectionStatus = derived(multiplayerState, $state => $state.connectionStatus);
export const currentGameId = derived(multiplayerState, $state => $state.gameId);

/**
 * Multiplayer actions
 */
export const multiplayerActions = {
    /**
     * Connect to a game
     */
    async connectToGame(gameId: string): Promise<void> {
        try {
            multiplayerState.update(state => ({
                ...state,
                connectionStatus: 'connecting',
                gameId,
                lastError: null
            }));

            // Create new WebSocket client if needed
            if (!wsClient) {
                wsClient = new GameWebSocketClient();
                setupWebSocketCallbacks();
            }

            await wsClient.connect(gameId);

            multiplayerState.update(state => ({
                ...state,
                isConnected: true,
                connectionStatus: 'connected'
            }));

            console.log(`✅ Connected to game: ${gameId}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Connection failed';

            multiplayerState.update(state => ({
                ...state,
                isConnected: false,
                connectionStatus: 'error',
                lastError: errorMessage
            }));

            console.error('❌ Failed to connect to game:', errorMessage);
            throw error;
        }
    },

    /**
     * Disconnect from current game
     */
    disconnect(): void {
        if (wsClient) {
            wsClient.disconnect();
            wsClient = null;
        }

        multiplayerState.set(initialState);
        gameUpdates.set(null);

        console.log('🔌 Disconnected from multiplayer');
    },

    /**
     * Send a message through WebSocket
     */
    sendMessage(message: any): void {
        if (wsClient?.isConnected()) {
            wsClient.send(message);
        } else {
            console.warn('⚠️ Cannot send message: not connected');
        }
    },

    /**
     * Get current connection status
     */
    getConnectionInfo(): MultiplayerState {
        let currentState: MultiplayerState = initialState;
        multiplayerState.subscribe(state => currentState = state)();
        return currentState;
    }
};

/**
 * Setup WebSocket event callbacks
 */
function setupWebSocketCallbacks(): void {
    if (!wsClient) return;

    wsClient.onConnected(() => {
        console.log('🟢 WebSocket connected');
        multiplayerState.update(state => ({
            ...state,
            isConnected: true,
            connectionStatus: 'connected',
            lastError: null
        }));
    });

    wsClient.onDisconnected(() => {
        console.log('🔴 WebSocket disconnected');
        multiplayerState.update(state => ({
            ...state,
            isConnected: false,
            connectionStatus: 'disconnected'
        }));
    });

    wsClient.onError((error) => {
        console.error('❌ WebSocket error:', error);
        multiplayerState.update(state => ({
            ...state,
            lastError: error,
            connectionStatus: 'error'
        }));
    });

    wsClient.onGameUpdate((data) => {
        console.log('🎮 Game update received:', data);

        const currentState = multiplayerActions.getConnectionInfo();

        gameUpdates.set({
            type: 'gameUpdate',
            gameId: currentState.gameId || '',
            data,
            timestamp: Date.now()
        });
    });

    wsClient.onPlayerJoined((data) => {
        console.log('👥 Player joined:', data);

        const currentState = multiplayerActions.getConnectionInfo();

        gameUpdates.set({
            type: 'playerJoined',
            gameId: currentState.gameId || '',
            data,
            timestamp: Date.now()
        });

        // Update player count if available
        if (data.playersOnline !== undefined) {
            multiplayerState.update(state => ({
                ...state,
                playersOnline: data.playersOnline
            }));
        }
    });

    // Start keep-alive pings
    wsClient.startKeepAlive(30000);
}

/**
 * Utility function to check if multiplayer is available
 */
export function isMultiplayerAvailable(): boolean {
    return typeof WebSocket !== 'undefined';
}

/**
 * Reset multiplayer state (useful for testing)
 */
export function resetMultiplayerState(): void {
    multiplayerActions.disconnect();
    multiplayerState.set(initialState);
    gameUpdates.set(null);
}
