/**
 * WebSocket client for Galactic Conflict real-time updates
 */

import { WebSocketClient } from '@svelte-mp/framework/client';
import type { WebSocketConfig } from '@svelte-mp/framework/shared';
import { buildWebSocketUrl, WEBSOCKET_WORKER_URL } from '$lib/websocket-config';
import { isLocalDevelopment } from '@svelte-mp/framework/shared';
import { updateGameState, isConnected } from '$lib/client/stores/gameStateStore';
import type { GalacticGameStateData } from '$lib/game/entities/gameTypes';
import { logger } from '$lib/game/utils/logger';

export class GameWebSocketClient {
    private client: WebSocketClient;
    private gameId: string | null = null;

    constructor() {
        const config: WebSocketConfig = {
            workerUrl: WEBSOCKET_WORKER_URL,
            localHost: 'localhost:8787',
        };

        this.client = new WebSocketClient(config);
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Game state updates
        this.client.onGameUpdate((data: any) => {
            console.log('[WebSocketClient] Received game update:', {
                hasGameState: !!data.gameState,
                recentBattleReplays: data.gameState?.recentBattleReplays?.length ?? 0,
                armadas: data.gameState?.armadas?.length ?? 0,
            });
            if (data.gameState) {
                updateGameState(data.gameState as GalacticGameStateData);
            }
        });

        // Game started
        this.client.onGameStarted((data: any) => {
            logger.debug('Game started');
            if (data.gameState) {
                updateGameState(data.gameState as GalacticGameStateData);
            }
        });

        // Player joined
        this.client.onPlayerJoined((data: any) => {
            logger.debug('Player joined:', data.player);
        });

        // Game ended
        this.client.onGameEnded((data: any) => {
            logger.debug('Game ended');
            if (data.gameState) {
                updateGameState(data.gameState as GalacticGameStateData);
            }
        });

        // Error handling
        this.client.onError((error: string) => {
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
     * Register custom event handler
     */
    on(messageType: string, callback: (data: any) => void): void {
        this.client.on(messageType, callback);
    }

    /**
     * Send a message
     */
    send(message: any): void {
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

