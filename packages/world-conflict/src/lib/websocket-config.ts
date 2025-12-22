/**
 * Shared WebSocket configuration for both client and server
 * This file can be imported from anywhere in the application
 */

import { isLocalDevelopment } from 'multiplayer-framework/shared';

// Update with your deployed worker URL
export const WEBSOCKET_WORKER_URL = 'https://multiplayer-games-websocket.barrybecker4.workers.dev';

/**
 * Build WebSocket URL for a specific game
 * @param gameId - The game ID to connect to
 * @returns WebSocket URL (ws:// for local, wss:// for production)
 */
export function buildWebSocketUrl(gameId: string): string {
    if (typeof window === 'undefined') {
        console.log('[buildWebSocketUrl] Window is undefined, returning empty string');
        return '';
    }

    // Validate gameId - allow 'lobby' as a special case
    if (!gameId || gameId === 'null' || gameId === 'undefined') {
        const error = `Invalid gameId for WebSocket connection: ${gameId}`;
        console.error('❌ [buildWebSocketUrl]', error);
        throw new Error(error);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isLocal = isLocalDevelopment();

    const host = isLocal
        ? 'localhost:8787'
        : WEBSOCKET_WORKER_URL.replace('https://', '').replace('http://', '');

    const url = `${protocol}//${host}/websocket?gameId=${encodeURIComponent(gameId)}`;
    return url;
}

/**
 * Get the HTTP URL for the WebSocket worker
 * @param isLocal - Whether we're in local development
 * @returns HTTP URL for the worker
 */
export function getWorkerHttpUrl(isLocal: boolean = false): string {
    const url = isLocal ? 'http://localhost:8787' : WEBSOCKET_WORKER_URL;
    console.log('[getWorkerHttpUrl]', { isLocal, url, constantValue: WEBSOCKET_WORKER_URL });
    
    if (!url) {
        throw new Error(`WebSocket worker URL is not defined! isLocal=${isLocal}, WEBSOCKET_WORKER_URL=${WEBSOCKET_WORKER_URL}`);
    }
    
    return url;
}