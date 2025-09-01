import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { GameStorage } from '$lib/storage/GameStorage';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper';
import type { Player } from '$lib/game/classes/GameState';
import { getErrorMessage } from '$lib/server/api-utils';

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'TIMEOUT' | 'DISCONNECT';
}


/**
 * Get game given gameId
 */
export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        const gameId = params.gameId;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Return the complete game record for World Conflict games
        return json({
            gameId: game.gameId,
            status: game.status,
            players: game.players,
            worldConflictState: game.worldConflictState,
            createdAt: game.createdAt,
            lastMoveAt: game.lastMoveAt,
            currentPlayerIndex: game.currentPlayerIndex,
            pendingConfiguration: game.pendingConfiguration,
            gameType: game.gameType
        });

    } catch (error) {
        console.error(`Error getting World Conflict game ${params.gameId}:`, error);
        return json({ error: 'Failed to load game: ' + getErrorMessage(error) }, { status: 500 });
    }
};

/**
 * Quit a game - either resigning or leaving a pending game
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId, reason = 'RESIGN' } = await request.json() as QuitGameRequest;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const kv = new KVStorage(platform!);
        const gameStorage = new GameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Find the player (convert playerId to index if needed)
        const playerIndex = parseInt(playerId);
        const player = game.players.find((p: Player) => p.index === playerIndex);

        if (!player) {
            return json({ error: 'Player not found in this game' }, { status: 404 });
        }

        // Handle different scenarios
        if (game.status === 'PENDING') {
            // Game hasn't started yet - remove player or delete game
            if (game.players.length === 1) {
                // Last player leaving, delete the game
                await gameStorage.deleteGame(gameId);
                console.log(`🗑️ Deleted pending game ${gameId} - last player left`);

                return json({
                    success: true,
                    message: 'Game deleted - you were the last player',
                    gameDeleted: true
                });
            } else {
                // Remove this player from the game
                const updatedPlayers = game.players.filter((p: Player) => p.index !== playerIndex);
                const updatedGame = {
                    ...game,
                    players: updatedPlayers,
                    lastMoveAt: Date.now()
                };

                 console.log("saveGame after removing player. gameId: " + updatedGame.gameId);
                await gameStorage.saveGame(updatedGame);
                await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

                console.log(`Player ${player.name} left pending game ${gameId}`);

                return json({
                    success: true,
                    message: `${player.name} left the game`,
                    game: updatedGame
                });
            }
        } else {
            // Game is active - player is resigning/disconnecting
            const updatedGame = {
                ...game,
                status: 'COMPLETED' as const,
                lastMoveAt: Date.now(),
                endReason: reason,
                endedBy: player.index
            };

            console.log("saveGame after resign. gameId: " + updatedGame.gameId);
            await gameStorage.saveGame(updatedGame);
            await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

            console.log(`Player ${player.name} ${reason.toLowerCase()} from active game ${gameId}`);

            return json({
                success: true,
                message: `${player.name} ${reason.toLowerCase()} from the game`,
                game: updatedGame,
                gameEnded: true
            });
        }

    } catch (error) {
        console.error('Error in quit game:', error);
        return json({
            error: 'Failed to quit game: ' + getErrorMessage(error)
        }, { status: 500 });
    }
};
