import type { StandardMessage } from '../shared/types';

/**
 * Callback types for message handling
 * @template TGameState - The type of the game state
 */
export interface MessageCallbacks<TGameState = unknown> {
  gameUpdate?: (data: TGameState) => void;
  gameStarted?: (data: TGameState) => void;
  playerJoined?: (data: TGameState) => void;
  gameEnded?: (data: TGameState) => void;
  error?: (error: string) => void;
  connected?: () => void;
  disconnected?: () => void;
  subscribed?: (gameId: string) => void;
  unsubscribed?: (gameId: string) => void;
  pong?: (timestamp: number) => void;
}

/**
 * Type for custom message handlers
 */
export type CustomMessageHandler<T = unknown> = (data: T) => void;

/**
 * Handles incoming WebSocket messages and delegates to appropriate callbacks
 * @template TGameState - The type of the game state payload
 */
export class MessageHandler<TGameState = unknown> {
  private callbacks: MessageCallbacks<TGameState> = {};
  private customHandlers: Map<string, CustomMessageHandler<unknown>> = new Map();

  /**
   * Process incoming WebSocket message
   */
  handleMessage(message: StandardMessage<TGameState>): void {
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
          this.callbacks.pong?.(message.timestamp);
          break;

        case 'error': {
          const errorText = message.error || message.gameState?.error || 'Unknown server error';
          console.error('❌ Server error:', errorText);
          this.callbacks.error?.(errorText);
          break;
        }

        case 'unsubscribed':
          console.log(`❌ Unsubscribed from game ${message.gameId}`);
          this.callbacks.unsubscribed?.(message.gameId);
          break;

        default: {
          // Support custom message types (falls through for subscribe, unsubscribe, ping)
          const customHandler = this.customHandlers.get(message.type);
          if (customHandler) {
            // For custom handlers, pass the gameState if available, otherwise the whole message
            const payload = 'gameState' in message ? message.gameState : message;
            customHandler(payload);
          } else if (!['subscribe', 'unsubscribe', 'ping'].includes(message.type)) {
            console.warn(`❓ Unknown message type: ${message.type}`);
            this.callbacks.error?.(`Unknown message type: ${message.type}`);
          }
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
  onGameUpdate(callback: (data: TGameState) => void): void {
    this.callbacks.gameUpdate = callback;
  }

  onGameStarted(callback: (data: TGameState) => void): void {
    this.callbacks.gameStarted = callback;
  }

  onPlayerJoined(callback: (data: TGameState) => void): void {
    this.callbacks.playerJoined = callback;
  }

  onGameEnded(callback: (data: TGameState) => void): void {
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
   * Register a custom message type handler with typed payload
   * @template TPayload - The expected type of the message payload
   * @param messageType - The message type to handle
   * @param callback - The callback function with typed payload
   */
  on<TPayload = unknown>(messageType: string, callback: (data: TPayload) => void): void {
    this.customHandlers.set(messageType, callback as CustomMessageHandler<unknown>);
  }

  clearCallbacks(): void {
    this.callbacks = {};
    this.customHandlers.clear();
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
