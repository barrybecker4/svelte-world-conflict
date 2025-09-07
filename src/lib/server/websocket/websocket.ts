import { WORKER_URL } from '$lib/server/api-utils.ts';

/**
 * WebSocket notification utilities for server-side use
 */
export interface GameUpdateNotification {
    gameId: string;
    type: 'gameUpdate' | 'playerJoined' | 'playerLeft' | 'gameStarted' | 'gameEnded';
    data: any;
}

/**
 * Send notification to WebSocket clients for a specific game
 */
export async function notifyGameUpdate(
    gameId: string,
    type: GameUpdateNotification['type'],
    data: any
): Promise<void> {
    try {
        const websocketUrl = `${getWebSocketNotifyUrl()}?gameId=${encodeURIComponent(gameId)}`;
        const notification = {
            gameId,
            message: {
                type,
                data
            }
        };

        const response = await fetch(websocketUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notification)
        });

        if (!response.ok) {
            console.warn(`WebSocket notification failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error notifying WebSocket clients:', error);
        // Don't fail the request if WebSocket notification fails
        // The API should still work even if real-time updates fail
    }
}

/**
 * Batch notify multiple game updates (useful for complex operations)
 */
export async function batchNotifyGameUpdates(notifications: GameUpdateNotification[]): Promise<void> {
    const promises = notifications.map(({ gameId, type, data }) =>
        notifyGameUpdate(gameId, type, data)
    );

    // Use Promise.allSettled to ensure one failure doesn't stop others
    await Promise.allSettled(promises);
}

/**
 * Get the WebSocket notification URL based on environment
 */
function getWebSocketNotifyUrl(): string {
    // Check if we're in development
    const isDev = process.env.NODE_ENV === 'development' ||
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (isDev) {
        // Local development WebSocket worker
        return 'http://localhost:8787/notify';
    }

    return WORKER_URL;
}

/**
 * Check if WebSocket notifications are available
 */
export async function checkWebSocketHealth(): Promise<boolean> {
    try {
        const healthUrl = getWebSocketNotifyUrl().replace('/notify', '/health');
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        return response.ok;
    } catch (error) {
        console.error('WebSocket health check failed:', error);
        return false;
    }
}

/**
 * Common game notification helpers
 */
export const GameNotifications = {

    playerJoined: (gameId: string, player: any, gameData: any) =>
        notifyGameUpdate(gameId, 'playerJoined', { player, gameData }),

    playerLeft: (gameId: string, playerId: string, gameData: any) =>
        notifyGameUpdate(gameId, 'playerLeft', { playerId, gameData }),

    gameStateChanged: (gameId: string, gameData: any, lastMove?: any) =>
        notifyGameUpdate(gameId, 'gameUpdate', { gameData, lastMove }),

    gameStarted: (gameId: string, gameData: any) =>
        notifyGameUpdate(gameId, 'gameStarted', { gameData }),

    gameEnded: (gameId: string, gameData: any, winner?: any) =>
        notifyGameUpdate(gameId, 'gameEnded', { gameData, winner })
};
