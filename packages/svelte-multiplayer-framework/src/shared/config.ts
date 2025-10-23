/**
 * WebSocket configuration utilities
 */

export interface WebSocketConfig {
  /**
   * Production WebSocket worker URL (without protocol)
   * Example: 'my-websocket-worker.workers.dev'
   */
  workerUrl: string;

  /**
   * Local development WebSocket host
   * Default: 'localhost:8787'
   */
  localHost?: string;
}

/**
 * Build WebSocket URL for a specific game
 * @param gameId - The game ID to connect to
 * @param config - WebSocket configuration
 * @returns WebSocket URL (ws:// for local, wss:// for production)
 */
export function buildWebSocketUrl(gameId: string, config: WebSocketConfig): string {
  if (typeof window === 'undefined') {
    console.warn('[buildWebSocketUrl] Window is undefined, returning empty string');
    return '';
  }

  // Validate gameId
  if (!gameId || gameId === 'null' || gameId === 'undefined') {
    const error = `Invalid gameId for WebSocket connection: ${gameId}`;
    console.error('[buildWebSocketUrl]', error);
    throw new Error(error);
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const host = isLocal
    ? config.localHost || 'localhost:8787'
    : config.workerUrl.replace('https://', '').replace('http://', '');

  const url = `${protocol}//${host}/websocket?gameId=${encodeURIComponent(gameId)}`;

  console.log('[buildWebSocketUrl] Built URL:', url);
  return url;
}

/**
 * Get the HTTP URL for the WebSocket worker
 * @param config - WebSocket configuration
 * @param isLocal - Whether we're in local development
 * @returns HTTP URL for the worker
 */
export function getWorkerHttpUrl(config: WebSocketConfig, isLocal: boolean = false): string {
  if (isLocal) {
    return `http://${config.localHost || 'localhost:8787'}`;
  }

  // Ensure the worker URL has a protocol
  const url = config.workerUrl;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Build notification URL for sending updates to the WebSocket worker
 * @param config - WebSocket configuration
 * @param isLocal - Whether we're in local development
 * @returns Notification endpoint URL
 */
export function buildNotificationUrl(config: WebSocketConfig, isLocal: boolean = false): string {
  const baseUrl = getWorkerHttpUrl(config, isLocal);
  return `${baseUrl}/notify`;
}

