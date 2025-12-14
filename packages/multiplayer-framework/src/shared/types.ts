/**
 * Base message interface for WebSocket communication
 * All messages should extend this interface
 */
export interface BaseMessage {
  type: string;
  timestamp?: number;
}

/**
 * Game state update message with generic game state type
 * @template TGameState - The type of the game state payload
 */
export interface GameStateMessage<TGameState = unknown> extends BaseMessage {
  gameId: string;
  gameState: TGameState;
}

/**
 * Subscription message - sent by client to subscribe to a game
 */
export interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  gameId: string;
  playerId?: string; // Optional player identifier (e.g., slot index) for disconnect tracking
}

/**
 * Subscribed confirmation message - sent by server
 */
export interface SubscribedMessage extends BaseMessage {
  type: 'subscribed';
  gameId: string;
}

/**
 * Unsubscribe message
 */
export interface UnsubscribeMessage extends BaseMessage {
  type: 'unsubscribe';
}

/**
 * Unsubscribed confirmation message
 */
export interface UnsubscribedMessage extends BaseMessage {
  type: 'unsubscribed';
  gameId: string;
}

/**
 * Ping message for keep-alive
 */
export interface PingMessage extends BaseMessage {
  type: 'ping';
  timestamp: number;
}

/**
 * Pong response message
 */
export interface PongMessage extends BaseMessage {
  type: 'pong';
  timestamp: number;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  /** @deprecated Use `error` property instead */
  gameState?: {
    error: string;
  };
}

/**
 * Generic game update message types
 * @template TGameState - The type of the game state payload
 */
export interface GameUpdateMessage<TGameState = unknown> extends GameStateMessage<TGameState> {
  type: 'gameUpdate';
}

export interface GameStartedMessage<TGameState = unknown> extends GameStateMessage<TGameState> {
  type: 'gameStarted';
}

export interface PlayerJoinedMessage<TGameState = unknown> extends GameStateMessage<TGameState> {
  type: 'playerJoined';
}

export interface GameEndedMessage<TGameState = unknown> extends GameStateMessage<TGameState> {
  type: 'gameEnded';
}

/**
 * Union type of all standard message types (framework-level messages)
 */
export type StandardMessage<TGameState = unknown> =
  | SubscribeMessage
  | SubscribedMessage
  | UnsubscribeMessage
  | UnsubscribedMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | GameUpdateMessage<TGameState>
  | GameStartedMessage<TGameState>
  | PlayerJoinedMessage<TGameState>
  | GameEndedMessage<TGameState>;

/**
 * Notification payload for HTTP notifications to the worker
 * @template TMessage - The type of message being sent
 */
export interface NotificationPayload<TMessage extends BaseMessage = BaseMessage> {
  gameId: string;
  message: TMessage;
}

/**
 * Notification response from the worker
 */
export interface NotificationResponse {
  success: boolean;
  sentCount: number;
  gameId: string;
}

/**
 * Player event notification (sent from worker to app on disconnect, etc.)
 */
export interface PlayerEventPayload {
  type: 'disconnect' | 'reconnect';
  playerId: string;
  timestamp: number;
}

/**
 * Helper type to extract the game state type from a message type
 */
export type ExtractGameState<T> = T extends GameStateMessage<infer TGameState> ? TGameState : never;

/**
 * Type guard to check if a message is a GameStateMessage
 */
export function isGameStateMessage<TGameState = unknown>(
  message: BaseMessage
): message is GameStateMessage<TGameState> {
  return 'gameId' in message && 'gameState' in message;
}

/**
 * Type guard to check if a message is an ErrorMessage
 */
export function isErrorMessage(message: BaseMessage): message is ErrorMessage {
  return message.type === 'error';
}
