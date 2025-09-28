// src/lib/server/websocket/WebSocketNotifier.ts
import type { GameRecord } from '$lib/server/storage/GameStorage';
import type { Player } from '$lib/game/state/GameState';
import { WORKER_URL } from '$lib/server/api-utils';

/**
 * Message types for WebSocket notifications
 */
export type NotificationType = 
    | 'gameUpdate'
    | 'playerJoined'
    | 'playerLeft'
    | 'gameStarted'
    | 'gameEnded';

/**
 * Fast failure - no retries, no fallbacks, just send and log
 */
class WebSocketNotifier {
    private readonly timeout = 3000;

    async gameUpdate(game: GameRecord): Promise<void> {
        await this.send(game.gameId, 'gameUpdate', game.worldConflictState);
    }

    async playerJoined(gameId: string, player: Player, game: GameRecord): Promise<void> {
        await this.send(gameId, 'playerJoined', {
            player,
            gameData: game
        });
    }

    async playerLeft(gameId: string, playerId: string, game: GameRecord): Promise<void> {
        await this.send(gameId, 'playerLeft', {
            playerId,
            gameData: game
        });
    }

    async gameStarted(gameId: string, game: GameRecord): Promise<void> {
        await this.send(gameId, 'gameStarted', { gameData: game });
    }

    async gameEnded(gameId: string, game: GameRecord, winner?: Player): Promise<void> {
        await this.send(gameId, 'gameEnded', {
            gameData: game,
            winner
        });
    }


    private async send(gameId: string, type: NotificationType, gameState: any): Promise<void> {
        const workerUrl = this.getWorkerUrl();
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
            throw new Error(`HTTP ${response.status}`);
        }

        console.log(`✅ ${type} sent for game ${gameId}`);
    }

    private getWorkerUrl(): string {
        const isDev = process.env.NODE_ENV === 'development' ||
            (typeof window !== 'undefined' && 
             (window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1'));

        return isDev ? 'http://localhost:8787' : WORKER_URL;
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