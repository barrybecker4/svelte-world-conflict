/**
 * Multiplayer actions service layer
 * Handles WebSocket connection management and messaging
 */

import { GameWebSocketClient } from '../websocket/GameWebSocketClient';
import { multiplayerState, gameUpdates } from './multiplayerStore';
import { type MultiplayerState, initialState } from './multiplayerTypes';

// WebSocket client instance
let wsClient: GameWebSocketClient | null = null;

export const multiplayerActions = {

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
            const errorMessage = error instanceof Error ?
                error.message : 'Connection failed';

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
 * This function bridges the WebSocket client events to Svelte store updates
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
