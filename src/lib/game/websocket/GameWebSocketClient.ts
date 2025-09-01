import { MessageHandler } from './MessageHandler';

/**
 * WebSocket client for World Conflict multiplayer communication
 * Handles real-time game updates with automatic reconnection
 */
export class GameWebSocketClient {
    private ws: WebSocket | null = null;
    private gameId: string | null = null;
    private messageHandler: MessageHandler;

    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectTimeout: number | null = null;

    constructor() {
        this.messageHandler = new MessageHandler();
    }

    /**
     * Connect to WebSocket server for a specific game
     */
    async connect(gameId: string): Promise<void> {
        this.gameId = gameId;

        return new Promise((resolve, reject) => {
            try {
                const wsUrl = this.buildWebSocketUrl(gameId);
                console.log('🔌 Connecting to WebSocket:', wsUrl);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected');
                    this.reconnectAttempts = 0;

                    // Subscribe to game updates
                    this.send({
                        type: 'subscribe',
                        gameId: gameId
                    });

                    this.messageHandler.onConnected?.();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.messageHandler.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                        this.messageHandler.onError?.('Failed to parse message');
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket closed:', event.code, event.reason);
                    this.messageHandler.onDisconnected?.();

                    // Try to reconnect if it wasn't a clean close
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.messageHandler.onError?.('WebSocket connection failed');
                    reject(new Error('WebSocket connection failed'));
                };

                // Connection timeout
                setTimeout(() => {
                    if (this.ws?.readyState !== WebSocket.OPEN) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }

        this.gameId = null;
        this.reconnectAttempts = 0;
        this.messageHandler.clearCallbacks();
    }

    /**
     * Check if WebSocket is connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Send message to server
     */
    send(message: any): void {
        if (this.isConnected()) {
            this.ws!.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ Cannot send message: WebSocket not connected');
        }
    }

    // Delegate callback registration to MessageHandler
    onGameUpdate(callback: (data: any) => void): void {
        this.messageHandler.onGameUpdate(callback);
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

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectTimeout = window.setTimeout(() => {
            if (this.gameId) {
                this.reconnectAttempts++;
                this.connect(this.gameId).catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }
        }, delay);
    }

    /**
     * Build WebSocket URL based on environment
     */
    private buildWebSocketUrl(gameId: string): string {
        if (typeof window === 'undefined') {
            return '';
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        const host = isLocal
            ? 'localhost:8787'
            : 'svelte-world-conflict-websocket.YOUR_USERNAME.workers.dev';

        const wsUrl = `${protocol}//${host}/websocket?gameId=${encodeURIComponent(gameId)}`;

        console.log(`🌐 Attempting WebSocket connection:`, {
            protocol,
            isLocal,
            host,
            wsUrl,
            gameId
        });

        return wsUrl;
    }

    /**
     * Send periodic ping to keep connection alive
     */
    startKeepAlive(intervalMs: number = 30000): void {
        const keepAlive = () => {
            if (this.isConnected()) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        };

        // Send initial ping after connection
        setTimeout(keepAlive, 1000);

        // Then send periodic pings
        setInterval(keepAlive, intervalMs);
    }
}