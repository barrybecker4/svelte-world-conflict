import type { Player } from '$lib/game/state/GameState';
import type { GameRecord } from '../storage/GameStorage';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import type { NotificationResponse } from '@svelte-mp/framework/shared';

/**
 * Handles notifying WebSocket clients about game updates
 * Uses HTTP POST to the worker's /notify endpoint
 */
class WebSocketNotifier {
    private readonly timeout = 3000;

    async gameUpdate(game: GameRecord): Promise<void> {
        // Include attack sequence and move metadata for battle replay and animation
        const gameStateWithSequence = {
            ...game.worldConflictState,
            attackSequence: game.lastAttackSequence,
            lastMove: game.lastMove
        };
        await this.send(game.gameId, 'gameUpdate', gameStateWithSequence);
    }

    async playerJoined(gameId: string, player: Player, game: GameRecord): Promise<void> {
        await this.send(gameId, 'playerJoined', { player, gameData: game });
    }

    async playerLeft(gameId: string, playerId: string, game: GameRecord): Promise<void> {
        await this.send(gameId, 'playerLeft', { playerId, gameData: game });
    }

    async gameStarted(gameId: string, game: GameRecord): Promise<void> {
        await this.send(gameId, 'gameStarted', { gameData: game });
    }

    async gameEnded(gameId: string, game: GameRecord, winner?: Player): Promise<void> {
        await this.send(gameId, 'gameEnded', { gameData: game, winner });
    }

    private async send(gameId: string, type: string, gameState: any): Promise<void> {
        let workerUrl: string | undefined;
        const startTime = Date.now();
        try {
            workerUrl = this.getWorkerUrl();
            console.log('📡 [WebSocketNotifier] Notifying WebSocket worker:', {
                url: workerUrl,
                type,
                gameId,
                timestamp: startTime,
                hasGameState: !!gameState,
                gameStateKeys: gameState ? Object.keys(gameState).slice(0, 10) : []
            });

            const body = JSON.stringify({
                gameId,
                message: {
                    type,
                    gameState,
                    timestamp: Date.now()
                }
            });

            console.log('📤 [WebSocketNotifier] Sending fetch request:', {
                url: `${workerUrl}/notify`,
                bodySize: body.length,
                gameId
            });

            const response = await fetch(`${workerUrl}/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body,
                signal: AbortSignal.timeout(this.timeout)
            });

            const elapsed = Date.now() - startTime;
            console.log('📨 [WebSocketNotifier] Fetch response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                elapsed: `${elapsed}ms`,
                gameId
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [WebSocketNotifier] Worker returned error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    workerUrl,
                    gameId,
                    type,
                    elapsed: `${elapsed}ms`
                });
                throw new Error(`Failed to notify WebSocket worker: ${response.statusText} (${response.status})`);
            }

            const result = await response.json() as NotificationResponse;
            if (result.sentCount === 0) {
                console.warn(`⚠️ [WebSocketNotifier] ${type} notification sent but NO CLIENTS received it for game ${gameId}:`, {
                    result,
                    elapsed: `${elapsed}ms`,
                    sentCount: result.sentCount,
                    message: 'This means no WebSocket clients are subscribed to this game. Check client connection and subscription.'
                });
            } else {
                console.log(`✅ [WebSocketNotifier] ${type} notification sent successfully for game ${gameId}:`, {
                    result,
                    elapsed: `${elapsed}ms`,
                    sentCount: result.sentCount
                });
            }
        } catch (error) {
            const elapsed = Date.now() - startTime;
            console.error('❌ [WebSocketNotifier] Error notifying WebSocket worker:', {
                error: error instanceof Error ? error.message : String(error),
                errorName: error instanceof Error ? error.name : 'Unknown',
                stack: error instanceof Error ? error.stack : undefined,
                workerUrl: workerUrl || 'undefined',
                gameId,
                type,
                elapsed: `${elapsed}ms`
            });
            // Don't throw - we don't want to fail the request if notifications fail
            // But this needs investigation if it happens repeatedly
        }
    }

    private getWorkerUrl(): string {
        // On the server, check NODE_ENV instead of window
        // In Cloudflare Pages, NODE_ENV might not be set, so default to production
        const isDev = (process.env.NODE_ENV === 'development' ||
                      process.env.NODE_ENV === 'dev') && 
                      process.env.NODE_ENV !== undefined;

        const url = getWorkerHttpUrl(isDev);
        console.log('🔧 [WebSocketNotifier] Worker URL determined:', { 
            isDev, 
            url, 
            nodeEnv: process.env.NODE_ENV,
            nodeEnvType: typeof process.env.NODE_ENV 
        });
        return url;
    }
}

const notifier = new WebSocketNotifier();

export const WebSocketNotifications = {
    gameUpdate: (game: GameRecord) => notifier.gameUpdate(game),
    playerJoined: (gameId: string, player: Player, game: GameRecord) =>
        notifier.playerJoined(gameId, player, game),
    playerLeft: (gameId: string, playerId: string, game: GameRecord) =>
        notifier.playerLeft(gameId, playerId, game),
    gameStarted: (gameId: string, game: GameRecord) =>
        notifier.gameStarted(gameId, game),
    gameEnded: (gameId: string, game: GameRecord, winner?: Player) =>
        notifier.gameEnded(gameId, game, winner)
};