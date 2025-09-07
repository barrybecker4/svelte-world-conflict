/**
 * Handles incoming WebSocket messages and delegates to appropriate callbacks
 */
export class MessageHandler {
    private callbacks: {
        gameUpdate?: (data: any) => void;
        gameStarted?: (data: any) => void;
        playerJoined?: (data: any) => void;
        gameEnded?: (data: any) => void;
        error?: (error: string) => void;
        connected?: () => void;
        disconnected?: () => void;
        subscribed?: (gameId: string) => void;
        unsubscribed?: (gameId: string) => void;
        pong?: (timestamp: number) => void;
    } = {};

    /**
     * Process incoming WebSocket message
     */
    handleMessage(message: any): void {
        console.log('📨 Received WebSocket message:', message.type);

        try {
            switch (message.type) {
                case 'subscribed':
                    console.log(`✅ Subscribed to game ${message.gameId}`);
                    this.callbacks.subscribed?.(message.gameId);
                    break;

                case 'gameUpdate':
                    this.callbacks.gameUpdate?.(message.data);
                    break;

                case 'gameStarted':
                    this.callbacks.gameStarted?.(message.data);
                    break;

                case 'playerJoined':
                    this.callbacks.playerJoined?.(message.data);
                    break;

                case 'gameEnded':
                    this.callbacks.gameEnded?.(message.data);
                    break;

                case 'pong':
                    // Handle ping/pong for keep-alive
                    this.callbacks.pong?.(message.timestamp);
                    break;

                case 'error':
                    console.error('❌ Server error:', message.data?.error);
                    this.callbacks.error?.(message.data?.error || 'Unknown server error');
                    break;

                case 'unsubscribed':
                    console.log(`❌ Unsubscribed from game ${message.gameId}`);
                    this.callbacks.unsubscribed?.(message.gameId);
                    break;

                default:
                    console.warn(`❓ Unknown message type: ${message.type}`);
                    this.callbacks.error?.(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            this.callbacks.error?.('Error processing message');
        }
    }

    /**
     * Register callback for game updates
     */
    onGameUpdate(callback: (data: any) => void): void {
        this.callbacks.gameUpdate = callback;
    }

    onGameStarted(callback: (data: any) => void): void {
        this.callbacks.gameStarted = callback;
    }

    onPlayerJoined(callback: (data: any) => void): void {
        this.callbacks.playerJoined = callback;
    }

    onGameEnded(callback: (data: any) => void): void {
        this.callbacks.gameEnded = callback;
    }

    onError(callback: (error: string) => void): void {
        this.callbacks.error = callback;
    }

    onConnected(callback: () => void): void {
        this.callbacks.connected = callback;
    }

    onDisconnected(callback: () => void): void {
        this.callbacks.disconnected = callback;
    }

    onSubscribed(callback: (gameId: string) => void): void {
        this.callbacks.subscribed = callback;
    }

    onUnsubscribed(callback: (gameId: string) => void): void {
        this.callbacks.unsubscribed = callback;
    }

    onPong(callback: (timestamp: number) => void): void {
        this.callbacks.pong = callback;
    }

    hasCallback(type: keyof typeof this.callbacks): boolean {
        return !!this.callbacks[type];
    }

    clearCallbacks(): void {
        this.callbacks = {};
    }
}
