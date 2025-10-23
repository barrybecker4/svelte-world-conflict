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
    [key: string]: ((data?: any) => void) | undefined;
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
          this.callbacks.gameUpdate?.(message.gameState);
          break;

        case 'gameStarted':
          this.callbacks.gameStarted?.(message.gameState);
          break;

        case 'playerJoined':
          this.callbacks.playerJoined?.(message.gameState);
          break;

        case 'gameEnded':
          this.callbacks.gameEnded?.(message.gameState);
          break;

        case 'pong':
          // Handle ping/pong for keep-alive
          this.callbacks.pong?.(message.timestamp);
          break;

        case 'error':
          console.error('❌ Server error:', message.gameState?.error);
          this.callbacks.error?.(message.gameState?.error || 'Unknown server error');
          break;

        case 'unsubscribed':
          console.log(`❌ Unsubscribed from game ${message.gameId}`);
          this.callbacks.unsubscribed?.(message.gameId);
          break;

        default:
          // Support custom message types
          const callback = this.callbacks[message.type];
          if (callback) {
            callback(message.gameState || message);
          } else {
            console.warn(`❓ Unknown message type: ${message.type}`);
            this.callbacks.error?.(`Unknown message type: ${message.type}`);
          }
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

  /**
   * Register a custom message type handler
   * @param messageType - The message type to handle
   * @param callback - The callback function
   */
  on(messageType: string, callback: (data: any) => void): void {
    this.callbacks[messageType] = callback;
  }

  clearCallbacks(): void {
    this.callbacks = {};
  }

  triggerConnected(): void {
    this.callbacks.connected?.();
  }

  triggerDisconnected(): void {
    this.callbacks.disconnected?.();
  }

  triggerError(error: string): void {
    this.callbacks.error?.(error);
  }
}

