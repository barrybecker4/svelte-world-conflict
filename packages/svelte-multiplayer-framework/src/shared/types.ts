/**
 * Base message interface for WebSocket communication
 * All messages should extend this interface
 */
export interface BaseMessage {
  type: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Game state update message
 */
export interface GameStateMessage extends BaseMessage {
  gameId: string;
  gameState: any;
}

/**
 * Subscription message - sent by client to subscribe to a game
 */
export interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  gameId: string;
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
  gameState?: {
    error: string;
  };
}

/**
 * Generic game update message types
 */
export interface GameUpdateMessage extends GameStateMessage {
  type: 'gameUpdate';
}

export interface GameStartedMessage extends GameStateMessage {
  type: 'gameStarted';
}

export interface PlayerJoinedMessage extends GameStateMessage {
  type: 'playerJoined';
}

export interface GameEndedMessage extends GameStateMessage {
  type: 'gameEnded';
}

/**
 * Union type of all standard message types
 */
export type StandardMessage =
  | SubscribeMessage
  | SubscribedMessage
  | UnsubscribeMessage
  | UnsubscribedMessage
  | PingMessage
  | PongMessage
  | ErrorMessage
  | GameUpdateMessage
  | GameStartedMessage
  | PlayerJoinedMessage
  | GameEndedMessage;

/**
 * Notification payload for HTTP notifications to the worker
 */
export interface NotificationPayload {
  gameId: string;
  message: BaseMessage;
}

/**
 * Notification response from the worker
 */
export interface NotificationResponse {
  success: boolean;
  sentCount: number;
  gameId: string;
}

