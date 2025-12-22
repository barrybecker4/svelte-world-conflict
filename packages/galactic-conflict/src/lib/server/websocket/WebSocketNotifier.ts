/**
 * Centralized WebSocket notification service for Galactic Conflict
 * Handles notifying connected clients about game updates via the WebSocket worker
 */

import type { GalacticGameStateData, Player } from '$lib/game/entities/gameTypes';
import { getWorkerHttpUrl, isLocalDevelopment, logger } from 'multiplayer-framework/shared';
import { WEBSOCKET_CONFIG } from '$lib/websocket-config';

class WebSocketNotifier {
    private readonly timeout = 3000;
    private workerUrl: string | null = null;

    /**
     * Notify clients about a game state update
     */
    async gameUpdate(gameId: string, gameState: GalacticGameStateData): Promise<void> {
        await this.send(gameId, 'gameUpdate', { gameId, gameState });
    }

    /**
     * Notify clients that a player has joined the game
     */
    async playerJoined(gameId: string, player: Player): Promise<void> {
        await this.send(gameId, 'playerJoined', { gameId, player });
    }

    /**
     * Notify clients that the game has started
     */
    async gameStarted(gameId: string, gameState: GalacticGameStateData): Promise<void> {
        await this.send(gameId, 'gameStarted', { gameId, gameState });
    }

    /**
     * Send a notification to the WebSocket worker
     */
    private async send(gameId: string, type: string, payload: Record<string, unknown>): Promise<void> {
        try {
            const workerUrl = this.getWorkerUrl();
            logger.debug(`WebSocket notify: ${type} for game ${gameId} to ${workerUrl}`);

            const body = JSON.stringify({
                gameId,
                message: {
                    type,
                    ...payload
                }
            });

            const response = await fetch(`${workerUrl}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`WebSocket worker error: ${response.status} - ${errorText}`);
                return;
            }

            const result = await response.json() as { success?: boolean; sentCount?: number };
            
            if (result.sentCount === 0) {
                logger.debug(`No clients received ${type} for game ${gameId}`);
            } else {
                logger.debug(`Sent ${type} to ${result.sentCount} clients for game ${gameId}`);
            }
        } catch (error) {
            logger.error(`WebSocket notification failed for ${type} game ${gameId}:`, error instanceof Error ? error.message : error);
            // Don't throw - we don't want to fail the request if notifications fail
        }
    }

    /**
     * Get the WebSocket worker URL (cached after first call)
     */
    private getWorkerUrl(): string {
        if (this.workerUrl) return this.workerUrl;

        // Server-side: we can't use window.location, so we check dev mode
        // In dev mode (vite dev), use localhost. In production (Cloudflare Pages), use production URL
        const isLocal = import.meta.env.DEV ?? false;
        
        this.workerUrl = getWorkerHttpUrl(WEBSOCKET_CONFIG, isLocal);
        return this.workerUrl;
    }
}

const notifier = new WebSocketNotifier();

export const WebSocketNotifications = {
    gameUpdate: (gameId: string, gameState: GalacticGameStateData) =>
        notifier.gameUpdate(gameId, gameState),
    playerJoined: (gameId: string, player: Player) =>
        notifier.playerJoined(gameId, player),
    gameStarted: (gameId: string, gameState: GalacticGameStateData) =>
        notifier.gameStarted(gameId, gameState)
};


