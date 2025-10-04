import { MessageHandler } from './MessageHandler';
import { ReconnectionManager } from './ReconnectionManager';
import { buildWebSocketUrl } from '$lib/websocket-config';

/**
 * WebSocket client for World Conflict multiplayer communication
 */
export class GameWebSocketClient {
    private ws: WebSocket | null = null;
    private gameId: string | null = null;
    private messageHandler: MessageHandler;
    private reconnectionManager: ReconnectionManager;
    private connectionTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.messageHandler = new MessageHandler();
        this.reconnectionManager = new ReconnectionManager();
    }

    /**
     * Connect to WebSocket server for a specific game
     */
    async connect(gameId: string): Promise<void> {
        this.gameId = gameId;

        return new Promise((resolve, reject) => {
            // Track if we've already resolved/rejected
            let settled = false;

            try {
                const wsUrl = buildWebSocketUrl(gameId);
                console.log('Connecting to WebSocket:', wsUrl);

                this.ws = new WebSocket(wsUrl);

                // Set up connection timeout - MUST clear when connection succeeds/fails
                this.connectionTimeout = setTimeout(() => {
                    if (!settled && this.ws?.readyState !== WebSocket.OPEN) {
                        settled = true;
                        console.error('❌ WebSocket connection timeout');
                        this.cleanup();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);

                this.ws.onopen = () => {
                    if (settled) return;
                    settled = true;

                    console.log('✅ WebSocket connected');
                    this.clearConnectionTimeout();
                    this.reconnectionManager.reset();

                    // Send subscribe message
                    this.send({ type: 'subscribe', gameId });
                    this.messageHandler.onConnected?.();

                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('📨 WebSocket message received:', {
                            type: message.type,
                            gameId: message.gameId,
                            hasGameState: !!message.gameState
                        });
                        this.messageHandler.handleMessage(message);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                        this.messageHandler.onError?.('Failed to parse message');
                    }
                };

                this.ws.onclose = (event) => {
                    console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`);
                    this.clearConnectionTimeout();
                    this.messageHandler.onDisconnected?.();

                    // If we haven't settled yet, this is an error
                    if (!settled) {
                        settled = true;
                        reject(new Error(`WebSocket closed before connection established: ${event.code}`));
                    }

                    // Auto-reconnect on unexpected close (but not if it's a clean close)
                    if (event.code !== 1000 && this.gameId) {
                        console.log('🔄 Scheduling reconnection...');
                        this.reconnectionManager.start(() => this.connect(this.gameId!));
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.clearConnectionTimeout();
                    this.messageHandler.onError?.('WebSocket connection failed');

                    // Only reject if we haven't already settled
                    if (!settled) {
                        settled = true;
                        reject(new Error('WebSocket connection failed'));
                    }
                };

            } catch (error) {
                if (!settled) {
                    settled = true;
                    this.clearConnectionTimeout();
                    reject(error);
                }
            }
        });
    }

    private clearConnectionTimeout(): void {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    private cleanup(): void {
        this.clearConnectionTimeout();
        if (this.ws) {
            // Remove event listeners to prevent callbacks after cleanup
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;

            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close(1000, 'Client cleanup');
            }
            this.ws = null;
        }
    }

    disconnect(): void {
        console.log('🔌 Disconnecting WebSocket');
        this.reconnectionManager.stop();
        this.cleanup();
        this.gameId = null;
        this.messageHandler.clearCallbacks();
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    send(message: any): void {
        if (this.isConnected()) {
            try {
                this.ws!.send(JSON.stringify(message));
                console.log('📤 Sent WebSocket message:', message.type);
            } catch (error) {
                console.error('❌ Error sending WebSocket message:', error);
            }
        } else {
            console.warn('⚠️ Cannot send message: WebSocket not connected (state:', this.ws?.readyState, ')');
        }
    }

    startKeepAlive(intervalMs: number = 30000): void {
        const keepAlive = () => {
            if (this.isConnected()) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        };

        setTimeout(keepAlive, 1000);
        setInterval(keepAlive, intervalMs);
    }

    // Delegate callback registration to MessageHandler
    onGameUpdate(callback: (data: any) => void): void {
        this.messageHandler.onGameUpdate(callback);
    }

    onGameStarted(callback: (data: any) => void): void {
        this.messageHandler.onGameStarted(callback);
    }

    onPlayerJoined(callback: (data: any) => void): void {
        this.messageHandler.onPlayerJoined(callback);
    }

    onError(callback: (error: string) => void): void {
        this.messageHandler.onError(callback);
    }

    onConnected(callback: () => void): void {
        this.messageHandler.onConnected(callback);
    }

    onDisconnected(callback: () => void): void {
        this.messageHandler.onDisconnected(callback);
    }

    onSubscribed(callback: (gameId: string) => void): void {
        this.messageHandler.onSubscribed(callback);
    }

    onUnsubscribed(callback: (gameId: string) => void): void {
        this.messageHandler.onUnsubscribed(callback);
    }
}
