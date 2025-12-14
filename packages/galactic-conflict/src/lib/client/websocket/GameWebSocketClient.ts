/**
 * WebSocket client for Galactic Conflict real-time updates
 * Provides full type safety for game state and messages
 */

import { WebSocketClient } from 'multiplayer-framework/client';
import type { WebSocketConfig, BaseMessage } from 'multiplayer-framework/shared';
import { WEBSOCKET_WORKER_URL } from '$lib/websocket-config';
import { updateGameState, isConnected } from '$lib/client/stores/gameStateStore';
import type { GalacticGameStateData } from '$lib/game/entities/gameTypes';
import { logger } from 'multiplayer-framework/shared';

/**
 * Game-specific outgoing message types
 * Extend this as needed for custom WebSocket messages
 */
export type GalacticConflictMessage = BaseMessage;

export class GameWebSocketClient {
    private client: WebSocketClient<GalacticGameStateData, GalacticConflictMessage>;
    private gameId: string | null = null;

    constructor() {
        const config: WebSocketConfig = {
            workerUrl: WEBSOCKET_WORKER_URL,
            localHost: 'localhost:8787',
        };

        this.client = new WebSocketClient<GalacticGameStateData, GalacticConflictMessage>(config);
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Game state updates - fully typed, no more `any` or manual casting!
        this.client.onGameUpdate((gameState) => {
            console.log('[WebSocketClient] Received game update:', {
                hasGameState: !!gameState,
                recentBattleReplays: gameState?.recentBattleReplays?.length ?? 0,
                armadas: gameState?.armadas?.length ?? 0,
            });
            if (gameState) {
                updateGameState(gameState);
            }
        });

        // Game started
        this.client.onGameStarted((gameState) => {
            logger.debug('Game started');
            if (gameState) {
                updateGameState(gameState);
            }
        });

        // Player joined
        this.client.onPlayerJoined((gameState) => {
            logger.debug('Player joined');
            // gameState contains player info if needed
        });

        // Game ended
        this.client.onGameEnded((gameState) => {
            logger.debug('Game ended');
            if (gameState) {
                updateGameState(gameState);
            }
        });

        // Error handling
        this.client.onError((error) => {
            logger.error('WebSocket error:', error);
        });

        // Connection events
        this.client.onConnected(() => {
            logger.info('WebSocket connected');
            isConnected.set(true);
        });

        this.client.onDisconnected(() => {
            logger.warn('WebSocket disconnected');
            isConnected.set(false);
            // No reconnect - fail fast. User must refresh page.
        });
    }

    /**
     * Connect to a game - throws if connection fails
     */
    async connect(gameId: string): Promise<void> {
        this.gameId = gameId;
        
        try {
            await this.client.connect(gameId);
            this.client.startKeepAlive(30000);
        } catch (error) {
            logger.error('Failed to connect:', error);
            throw error;
        }
    }

    /**
     * Disconnect from the current game
     */
    disconnect(): void {
        this.client.disconnect();
        this.gameId = null;
        isConnected.set(false);
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.client.isConnected();
    }

    /**
     * Register custom event handler with typed payload
     */
    on<TPayload = unknown>(messageType: string, callback: (data: TPayload) => void): void {
        this.client.on<TPayload>(messageType, callback);
    }

    /**
     * Send a typed message
     */
    send(message: GalacticConflictMessage): void {
        this.client.send(message);
    }
}

// Singleton instance
let clientInstance: GameWebSocketClient | null = null;

export function getWebSocketClient(): GameWebSocketClient {
    if (!clientInstance) {
        clientInstance = new GameWebSocketClient();
    }
    return clientInstance;
}
