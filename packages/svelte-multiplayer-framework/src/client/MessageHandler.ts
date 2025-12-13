import type { 
  BaseMessage, 
  ErrorMessage, 
  SubscribedMessage, 
  UnsubscribedMessage,
  PongMessage,
  GameStateMessage
} from '../shared/types';

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
  handleMessage(message: BaseMessage): void {
    console.log('📨 Received WebSocket message:', message.type);

    try {
      switch (message.type) {
        case 'subscribed': {
          const msg = message as unknown as SubscribedMessage;
          console.log(`✅ Subscribed to game ${msg.gameId}`);
          this.callbacks.subscribed?.(msg.gameId);
          break;
        }

        case 'gameUpdate': {
          const msg = message as unknown as GameStateMessage<TGameState>;
          this.callbacks.gameUpdate?.(msg.gameState);
          break;
        }

        case 'gameStarted': {
          const msg = message as unknown as GameStateMessage<TGameState>;
          this.callbacks.gameStarted?.(msg.gameState);
          break;
        }

        case 'playerJoined': {
          const msg = message as unknown as GameStateMessage<TGameState>;
          this.callbacks.playerJoined?.(msg.gameState);
          break;
        }

        case 'gameEnded': {
          const msg = message as unknown as GameStateMessage<TGameState>;
          this.callbacks.gameEnded?.(msg.gameState);
          break;
        }

        case 'pong': {
          const msg = message as unknown as PongMessage;
          this.callbacks.pong?.(msg.timestamp);
          break;
        }

        case 'error': {
          const errorMsg = message as unknown as ErrorMessage;
          const errorText = errorMsg.error || errorMsg.gameState?.error || 'Unknown server error';
          console.error('❌ Server error:', errorText);
          this.callbacks.error?.(errorText);
          break;
        }

        case 'unsubscribed': {
          const msg = message as unknown as UnsubscribedMessage;
          console.log(`❌ Unsubscribed from game ${msg.gameId}`);
          this.callbacks.unsubscribed?.(msg.gameId);
          break;
        }

        default: {
          // Support custom message types
          const customHandler = this.customHandlers.get(message.type);
          if (customHandler) {
            // For custom handlers, pass the gameState if available, otherwise the whole message
            const payload = 'gameState' in message 
              ? (message as unknown as { gameState: unknown }).gameState 
              : message;
            customHandler(payload);
          } else {
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
