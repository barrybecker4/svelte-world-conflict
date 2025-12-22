/**
 * World Conflict-specific wrapper around the framework WebSocketClient
 * Provides full type safety for game state and messages
 */
import { WebSocketClient } from 'multiplayer-framework/client';
import type { BaseMessage } from 'multiplayer-framework/shared';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { WEBSOCKET_CONFIG } from '$lib/websocket-config';

/**
 * Game-specific outgoing message types
 * Extend this as needed for custom WebSocket messages
 */
export type WorldConflictMessage = BaseMessage;

/**
 * Game WebSocket Client for World Conflict
 * Wraps the framework WebSocketClient with game-specific configuration and types
 */
export class GameWebSocketClient extends WebSocketClient<GameStateData, WorldConflictMessage> {
  constructor(playerId?: string) {
    super(WEBSOCKET_CONFIG, playerId);
  }
}
