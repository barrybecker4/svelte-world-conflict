import { MessageHandler } from './MessageHandler';
import { ReconnectionManager } from './ReconnectionManager';

/**
 * WebSocket client for World Conflict multiplayer communication
 * Handles real-time game updates with automatic reconnection
 */
export class GameWebSocketClient {
    private ws: WebSocket | null = null;
    private gameId: string | null = null;
    private messageHandler: MessageHandler;
    private reconnectionManager: ReconnectionManager;

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
            try {
                const wsUrl = this.buildWebSocketUrl(gameId);
                console.log('🔌 Connecting to WebSocket:', wsUrl);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected');
                    this.reconnectionManager.reset();
                    this.send({ type: 'subscribe', gameId });
                    this.messageHandler.onConnected?.();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('📨 RAW WebSocket message:', {
                            type: message.type,
                            hasGameState: !!message.gameState,
                            gameId: message.gameId,
                            fullMessage: message
                        });
                        this.messageHandler.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                        this.messageHandler.onError?.('Failed to parse message');
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket closed:', event.code, event.reason);
                    this.messageHandler.onDisconnected?.();

                    // Auto-reconnect on unexpected close
                    if (event.code !== 1000) {
                        this.reconnectionManager.start(() => this.connect(this.gameId!));
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

    disconnect(): void {
        this.reconnectionManager.stop();
        if (this.ws) {
            this.ws.close(1000, 'Client disconnecting');
            this.ws = null;
        }
        this.gameId = null;
        this.messageHandler.clearCallbacks();
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    send(message: any): void {
        if (this.isConnected()) {
            this.ws!.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ Cannot send message: WebSocket not connected');
        }
    }

    private buildWebSocketUrl(gameId: string): string {
        if (typeof window === 'undefined') return '';

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const host = isLocal ? 'localhost:8787' : 'svelte-world-conflict-websocket.YOUR_USERNAME.workers.dev';

        return `${protocol}//${host}/websocket?gameId=${encodeURIComponent(gameId)}`;
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