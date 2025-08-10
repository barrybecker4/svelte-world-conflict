import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player } from '$lib/game/WorldConflictGameState.ts';
import { createPlayer } from '$lib/server/api-utils.js';
import { getErrorMessage } from '$lib/server/api-utils.ts';

interface JoinGameRequest {
    playerName: string;
}

function generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerName } = await request.json() as JoinGameRequest;

        if (!playerName || !playerName.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Only allow joining PENDING games
        if (game.status !== 'PENDING') {
            return json({ error: 'Game is no longer accepting new players' }, { status: 400 });
        }

        // Check if game is full
        if (game.players.length >= 4) {
            return json({ error: 'Game is full' }, { status: 400 });
        }

        // Check if player name is already taken in this game
        if (game.players.some((p: Player) => p.name === playerName.trim())) {
            return json({ error: 'Player name already taken in this game' }, { status: 400 });
        }

        const newPlayer = createPlayer(playerName, game.players.length);
        const updatedPlayers = [...game.players, newPlayer];

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
            // Keep status as 'PENDING' - don't auto-start!
            // Game only starts when creator clicks "Start anyway" or all 4 slots filled
        };

        // Only auto-start if all 4 slots are now filled with human players
        if (updatedPlayers.length >= 4) {
            updatedGame.status = 'ACTIVE';

            // Initialize World Conflict game state
            const gameState = WorldConflictGameState.createInitialState(
                gameId,
                updatedPlayers,
                game.worldConflictState.regions || []
            );

            updatedGame.worldConflictState = gameState.toJSON();
        }

        console.log("saveGame after join. gameId: " + updatedGame.gameId);
        await gameStorage.saveGame(updatedGame);
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        return json({
            success: true,
            player: newPlayer,
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            }
        });

    } catch (error) {
        console.error('Error joining game:', error);
        return json({
            error: 'Failed to join game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};
