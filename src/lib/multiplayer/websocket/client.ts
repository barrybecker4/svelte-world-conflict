/**
 * WebSocket client for World Conflict multiplayer communication
 * Handles real-time game updates with automatic reconnection
 */
export class GameWebSocketClient {
    private ws: WebSocket | null = null;
    private gameId: string | null = null;
    private callbacks: {
        gameUpdate?: (data: any) => void;
        playerJoined?: (data: any) => void;
        error?: (error: string) => void;
        connected?: () => void;
        disconnected?: () => void;
    } = {};

    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectTimeout: number | null = null;

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

                    this.callbacks.connected?.();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket closed:', event.code, event.reason);
                    this.callbacks.disconnected?.();

                    // Try to reconnect if it wasn't a clean close
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.callbacks.error?.('WebSocket connection failed');
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

    /**
     * Set callback for game updates
     */
    onGameUpdate(callback: (data: any) => void): void {
        this.callbacks.gameUpdate = callback;
    }

    /**
     * Set callback for player joined events
     */
    onPlayerJoined(callback: (data: any) => void): void {
        this.callbacks.playerJoined = callback;
    }

    /**
     * Set callback for errors
     */
    onError(callback: (error: string) => void): void {
        this.callbacks.error = callback;
    }

    /**
     * Set callback for connection events
     */
    onConnected(callback: () => void): void {
        this.callbacks.connected = callback;
    }

    /**
     * Set callback for disconnection events
     */
    onDisconnected(callback: () => void): void {
        this.callbacks.disconnected = callback;
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage(message: any): void {
        console.log('📨 Received WebSocket message:', message.type);

        switch (message.type) {
            case 'subscribed':
                console.log(`✅ Subscribed to game ${message.gameId}`);
                break;

            case 'gameUpdate':
                this.callbacks.gameUpdate?.(message.data);
                break;

            case 'playerJoined':
                this.callbacks.playerJoined?.(message.data);
                break;

            case 'pong':
                // Handle ping/pong for keep-alive
                break;

            case 'error':
                console.error('❌ Server error:', message.data?.error);
                this.callbacks.error?.(message.data?.error || 'Unknown server error');
                break;

            default:
                console.warn(`❓ Unknown message type: ${message.type}`);
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

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
