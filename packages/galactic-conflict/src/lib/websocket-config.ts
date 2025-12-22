/**
 * WebSocket configuration for Galactic Conflict
 * Uses the multiplayer-framework's shared utilities
 */

import type { WebSocketConfig } from 'multiplayer-framework/shared';

export const WEBSOCKET_CONFIG: WebSocketConfig = {
  workerUrl: 'https://multiplayer-games-websocket.barrybecker4.workers.dev'
};
