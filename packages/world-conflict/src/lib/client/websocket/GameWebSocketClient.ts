/**
 * World Conflict-specific wrapper around the framework WebSocketClient
 * This maintains backward compatibility with existing code
 */
import { WebSocketClient } from '@svelte-mp/framework/client';
import type { WebSocketConfig } from '@svelte-mp/framework/shared';
import { WEBSOCKET_WORKER_URL } from '$lib/websocket-config';

/**
 * Game WebSocket Client for World Conflict
 * Wraps the framework WebSocketClient with game-specific configuration
 */
export class GameWebSocketClient extends WebSocketClient {
  constructor(playerId?: string) {
    const config: WebSocketConfig = {
      workerUrl: WEBSOCKET_WORKER_URL,
      localHost: 'localhost:8787'
    };
    super(config, playerId);
  }
}
