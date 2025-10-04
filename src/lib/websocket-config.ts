/**
 * Shared WebSocket configuration for both client and server
 * This file can be imported from anywhere in the application
 */

// Update with your deployed worker URL
const WEBSOCKET_WORKER_URL = 'https://svelte-world-conflict-websocket.barrybecker4.workers.dev';

/**
 * Build WebSocket URL for a specific game
 * @param gameId - The game ID to connect to
 * @returns WebSocket URL (ws:// for local, wss:// for production)
 */
export function buildWebSocketUrl(gameId: string): string {
    if (typeof window === 'undefined') return '';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

    const host = isLocal
        ? 'localhost:8787'
        : WEBSOCKET_WORKER_URL.replace('https://', '').replace('http://', '');

    return `${protocol}//${host}/websocket?gameId=${encodeURIComponent(gameId)}`;
}

/**
 * Get the HTTP URL for the WebSocket worker
 * @param isLocal - Whether we're in local development
 * @returns HTTP URL for the worker
 */
export function getWorkerHttpUrl(isLocal: boolean = false): string {
    return isLocal ? 'http://localhost:8787' : WEBSOCKET_WORKER_URL;
}
