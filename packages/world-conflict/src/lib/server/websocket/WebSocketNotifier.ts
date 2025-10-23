import type { Player } from '$lib/game/state/GameState';
import type { GameRecord } from '../storage/GameStorage';
import { getWorkerHttpUrl } from '$lib/websocket-config';

/**
 * Handles notifying WebSocket clients about game updates
 * Uses HTTP POST to the worker's /notify endpoint
 */
class WebSocketNotifier {
    private readonly timeout = 3000;

    async gameUpdate(game: GameRecord): Promise<void> {
        // Include attack sequence for battle replay
        const gameStateWithSequence = {
            ...game.worldConflictState,
            attackSequence: game.lastAttackSequence
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
        try {
            workerUrl = this.getWorkerUrl();
            console.log('Notifying WebSocket worker:', {
                url: workerUrl,
                type,
                gameId,
                isDev: process.env.NODE_ENV === 'development'
            });

            const response = await fetch(`${workerUrl}/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameId,
                    message: {
                        type,
                        gameState,
                        timestamp: Date.now()
                    }
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ WebSocket worker returned error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText,
                    workerUrl,
                    gameId,
                    type
                });
                throw new Error(`Failed to notify WebSocket worker: ${response.statusText} (${response.status})`);
            }

            const result = await response.json();
            console.log(`✅ ${type} notification sent successfully for game ${gameId}:`, result);
        } catch (error) {
            console.error('❌ Error notifying WebSocket worker:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                workerUrl: workerUrl || 'undefined',
                gameId,
                type
            });
            // Don't throw - we don't want to fail the request if notifications fail
            // But this needs investigation if it happens repeatedly
        }
    }

    private getWorkerUrl(): string {
        // On the server, check NODE_ENV instead of window
        const isDev = process.env.NODE_ENV === 'development' ||
                      process.env.NODE_ENV === 'dev';

        const url = getWorkerHttpUrl(isDev);
        console.log('Worker URL determined:', { isDev, url, nodeEnv: process.env.NODE_ENV });
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