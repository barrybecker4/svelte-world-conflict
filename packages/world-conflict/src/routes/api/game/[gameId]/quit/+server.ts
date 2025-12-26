import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState, type Player } from '$lib/game/state/GameState';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { logger } from 'multiplayer-framework/shared';
import { eliminateAndAdvanceTurn, getActiveSlots } from '$lib/server/utils/playerGameUtils';

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'DISCONNECT' | 'TIMEOUT';
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        if (!gameId) {
            return json({ error: 'Missing gameId' }, { status: 400 });
        }

        const body = (await request.json()) as QuitGameRequest;
        const { playerId, reason = 'RESIGN' } = body;

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);

        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        const playerSlotIndex = parseInt(playerId);
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);

        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        if (game.status === 'PENDING') {
            return await quitFromPendingGame(gameId, game, playerSlotIndex, player, playerId, gameStorage);
        } else {
            return await quitFromActiveGame(gameId, game, player, gameStorage);
        }
    } catch (error) {
        logger.error('Error processing quit:', error);
        return json({ error: 'Failed to process quit' }, { status: 500 });
    }
};

async function quitFromPendingGame(
    gameId: string,
    game: GameRecord,
    playerSlotIndex: number,
    player: Player,
    playerId: string,
    gameStorage: GameStorage
) {
    if (game.players.length === 1) {
        await gameStorage.deleteGame(gameId);
        logger.info(`Deleted pending game ${gameId} - last player left`);

        return json({
            success: true,
            message: 'Game deleted - you were the last player',
            gameDeleted: true
        });
    } else {
        const updatedPlayers = game.players.filter(p => p.slotIndex !== playerSlotIndex);
        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);
        logger.info(`Player ${player.name} left pending game ${gameId}`);

        await WebSocketNotifications.playerLeft(gameId, playerId, updatedGame);

        return json({
            success: true,
            message: `${player.name} left the game`,
            game: updatedGame
        });
    }
}

async function quitFromActiveGame(gameId: string, game: GameRecord, player: Player, gameStorage: GameStorage) {
    const playerSlotIndex = player.slotIndex;
    logger.info(`Player ${player.name} (slot ${playerSlotIndex}) resigned from active game ${gameId}`);

    let gameState = GameState.fromJSON(game.worldConflictState);

    // Eliminate the player and advance turn if needed
    gameState = eliminateAndAdvanceTurn(gameState, playerSlotIndex, player.name);

    const updatedStateData = gameState.toJSON();
    const activeSlots = getActiveSlots(game.players, updatedStateData);

    logger.debug(`After elimination - Active players remaining: ${activeSlots.length}`);

    const gameEndResult = checkGameEnd(updatedStateData, game.players);

    let updatedGame: GameRecord;
    let shouldEndGame = false;

    logger.debug(`Game end check: ended=${gameEndResult.isGameEnded}, winner=${gameEndResult.winner}`);

    if (gameEndResult.isGameEnded) {
        updatedGame = {
            ...game,
            status: 'COMPLETED' as const,
            worldConflictState: {
                ...updatedStateData,
                endResult: gameEndResult.winner
            },
            lastMoveAt: Date.now()
        };
        shouldEndGame = true;
        logger.info(`Game ${gameId} ended after resignation - winner: ${gameEndResult.winner}`);
    } else {
        updatedGame = {
            ...game,
            worldConflictState: updatedStateData,
            lastMoveAt: Date.now()
        };
        logger.debug(`Game continues with remaining active players`);
    }

    await gameStorage.saveGame(updatedGame);
    await WebSocketNotifications.gameUpdate(updatedGame);

    return json({
        success: true,
        message: `${player.name} resigned from the game`,
        game: updatedGame,
        gameEnded: shouldEndGame
    });
}
