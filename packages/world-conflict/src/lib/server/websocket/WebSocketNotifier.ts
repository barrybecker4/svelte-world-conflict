import type { Player, GameStateData } from '$lib/game/state/GameState';
import type { GameRecord } from '../storage/GameStorage';
import { getWorkerHttpUrl, logger } from 'multiplayer-framework/shared';
import type { NotificationResponse } from 'multiplayer-framework/shared';
import { WEBSOCKET_CONFIG } from '$lib/websocket-config';

/** Payload for game state updates with battle replay data */
interface GameUpdatePayload extends GameStateData {
    attackSequence?: unknown[];
    lastMove?: GameRecord['lastMove'];
    turnMoves?: GameRecord['turnMoves'];
}

/** Payload for player events */
interface PlayerEventPayload {
    player?: Player;
    playerId?: string;
    gameData: GameRecord;
}

/** Payload for game lifecycle events */
interface GameEventPayload {
    gameData: GameRecord;
    winner?: Player;
}

type NotificationPayload = GameUpdatePayload | PlayerEventPayload | GameEventPayload;

/**
 * Handles notifying WebSocket clients about game updates
 * Uses HTTP POST to the worker's /notify endpoint
 */
class WebSocketNotifier {
    private readonly timeout = 3000;
    private workerUrl: string | null = null;

    async gameUpdate(game: GameRecord): Promise<void> {
        const payload: GameUpdatePayload = {
            ...game.worldConflictState,
            attackSequence: game.lastAttackSequence,
            lastMove: game.lastMove,
            turnMoves: game.turnMoves
        };
        await this.send(game.gameId, 'gameUpdate', payload);
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

    private async send(gameId: string, type: string, payload: NotificationPayload): Promise<void> {
        try {
            const workerUrl = this.getWorkerUrl();
            logger.debug(`WebSocket notify: ${type} for game ${gameId}`);

            const body = JSON.stringify({
                gameId,
                message: {
                    type,
                    gameState: payload,
                    timestamp: Date.now()
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

            const result = await response.json() as NotificationResponse;
            if (result.sentCount === 0) {
                logger.debug(`No clients received ${type} for game ${gameId}`);
            }
        } catch (error) {
            logger.error('WebSocket notification failed:', error instanceof Error ? error.message : error);
            // Don't throw - we don't want to fail the request if notifications fail
        }
    }

    private getWorkerUrl(): string {
        // Cache the URL to avoid repeated lookups
        if (this.workerUrl) return this.workerUrl;

        const isDev = (process.env.NODE_ENV === 'development' ||
                      process.env.NODE_ENV === 'dev') && 
                      process.env.NODE_ENV !== undefined;

        this.workerUrl = getWorkerHttpUrl(WEBSOCKET_CONFIG, isDev);
        return this.workerUrl;
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
