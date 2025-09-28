import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameNotifications } from '$lib/server/websocket/websocket';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import type { Player } from '$lib/game/state/GameState';

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'DISCONNECT' | 'TIMEOUT';
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        if (!gameId) {
            return json({ error: "Missing gameId" }, { status: 400 });
        }

        const body = await request.json() as QuitGameRequest;
        const { playerId, reason = 'RESIGN' } = body;

        if (!playerId || typeof playerId !== 'string') {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        // Use GameStorage instead of direct KVStorage to ensure consistent key format
        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);

        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Find the player - convert playerId to number since it's stored as index
        const playerSlotIndex = parseInt(playerId);
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);

        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Handle different scenarios
        if (game.status === 'PENDING') {
            return await quitFromPendingGame(gameId, game, playerSlotIndex, player, playerId, gameStorage, platform);
        } else {
            return await quitFromActiveGame(gameId, game, player, gameStorage, platform);
        }

    } catch (error) {
        console.error('Error processing quit:', error);
        return json({ error: 'Failed to process quit' }, { status: 500 });
    }
};

async function quitFromPendingGame(
    gameId: string,
    game: GameRecord,
    playerSlotIndex: number,
    player: Player,
    playerId: string,
    gameStorage: GameStorage,
    platform: any
) {
    // Game hasn't started yet - remove player or delete game
    if (game.players.length === 1) {
        // Last player leaving, delete the game
        await gameStorage.deleteGame(gameId);
        console.log(`Deleted pending game ${gameId} - last player left`);

        return json({
            success: true,
            message: 'Game deleted - you were the last player',
            gameDeleted: true
        });
    } else {
        // Remove this player from the game
        const updatedPlayers = game.players.filter(p => p.slotIndex !== playerSlotIndex);
        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        console.log(`Player ${player.name} left pending game ${gameId}`);

        // Notify other players
        await GameNotifications.playerLeft(gameId, playerId, updatedGame, platform);

        return json({
            success: true,
            message: `${player.name} left the game`,
            game: updatedGame
        });
    }
}

async function quitFromActiveGame(
    gameId: string,
    game: GameRecord,
    player: Player,
    gameStorage: GameStorage,
    platform: any
) {
    const updatedGame = {
        ...game,
        status: 'COMPLETED' as const,
        lastMoveAt: Date.now()
    };

    await gameStorage.saveGame(updatedGame);
    console.log(`Player ${player.name} resigned from active game ${gameId}`);

    // Notify other players
    await GameNotifications.gameEnded(gameId, updatedGame, platform);

    return json({
        success: true,
        message: `${player.name} resigned from the game`,
        game: updatedGame,
        gameEnded: true
    });
}