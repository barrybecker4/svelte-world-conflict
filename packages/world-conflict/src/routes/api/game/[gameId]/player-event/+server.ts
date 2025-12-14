import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { logger } from 'multiplayer-framework/shared';
import { eliminateAndAdvanceTurn } from '$lib/server/utils/playerGameUtils';

interface PlayerEventRequest {
    type: 'disconnect' | 'reconnect' | 'idle';
    playerId: string;
    timestamp: number;
}

/**
 * Convention-based endpoint for player events from the WebSocket Durable Object
 * Handles disconnects, reconnects, and other player lifecycle events
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        if (!gameId) {
            return json({ error: "Missing gameId" }, { status: 400 });
        }

        const body = await request.json() as PlayerEventRequest;
        const { type, playerId } = body;

        logger.debug(`[player-event] Received ${type} event for player ${playerId} in game ${gameId}`);

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        switch (type) {
            case 'disconnect':
                return await handlePlayerDisconnect(gameId, playerId, platform);
            case 'reconnect':
                return await handlePlayerReconnect(gameId, playerId);
            case 'idle':
                return await handlePlayerIdle(gameId, playerId);
            default:
                logger.warn(`[player-event] Unknown event type: ${type}`);
                return json({ error: `Unknown event type: ${type}` }, { status: 400 });
        }

    } catch (error) {
        logger.error('[player-event] Error processing player event:', error);
        return json({ error: 'Failed to process player event' }, { status: 500 });
    }
};

/**
 * Handle player disconnect - eliminate player from active game
 */
async function handlePlayerDisconnect(
    gameId: string,
    playerId: string,
    platform: App.Platform | undefined
): Promise<Response> {
    const gameStorage = GameStorage.create(platform!);
    const game = await gameStorage.getGame(gameId);

    if (!game) {
        logger.warn(`[disconnect] Game ${gameId} not found`);
        return json({ error: 'Game not found' }, { status: 404 });
    }

    const playerSlotIndex = parseInt(playerId);
    const player = game.players.find(p => p.slotIndex === playerSlotIndex);

    if (!player) {
        logger.warn(`[disconnect] Player ${playerId} not found in game ${gameId}`);
        return json({ error: 'Player not found in game' }, { status: 400 });
    }

    // Only process disconnects for active games
    if (game.status !== 'ACTIVE') {
        logger.debug(`[disconnect] Game ${gameId} is ${game.status}, ignoring disconnect for player ${player.name}`);
        return json({
            success: true,
            message: 'Disconnect ignored - game not active',
            gameStatus: game.status
        });
    }

    // Ignore disconnects if game just started (within last 5 seconds)
    const timeSinceLastMove = Date.now() - game.lastMoveAt;
    if (timeSinceLastMove < 5000) {
        logger.debug(`[disconnect] Ignoring disconnect for player ${player.name} - game just started`);
        return json({
            success: true,
            message: 'Disconnect ignored - game just started',
            timeSinceStart: timeSinceLastMove
        });
    }

    // Check if player is already eliminated
    const eliminatedPlayers = game.worldConflictState?.eliminatedPlayers || [];
    if (eliminatedPlayers.includes(playerSlotIndex)) {
        logger.debug(`[disconnect] Player ${player.name} already eliminated, ignoring disconnect`);
        return json({
            success: true,
            message: 'Player already eliminated',
            alreadyEliminated: true
        });
    }

    logger.info(`[disconnect] Processing disconnect for player ${player.name} (slot ${playerSlotIndex}) in game ${gameId}`);

    // Eliminate the player and advance turn if needed
    let gameState = GameState.fromJSON(game.worldConflictState);
    gameState = eliminateAndAdvanceTurn(gameState, playerSlotIndex, player.name);

    const updatedStateData = gameState.toJSON();

    // Check if game should end
    const activeSlots = game.players
        .filter(p => !updatedStateData.eliminatedPlayers.includes(p.slotIndex))
        .map(p => p.slotIndex);

    const gameEndResult = checkGameEnd(updatedStateData, game.players);
    
    let updatedGame: GameRecord;
    let shouldEndGame = false;

    logger.debug(`[disconnect] Game end check: ended=${gameEndResult.isGameEnded}, winner=${gameEndResult.winner}, activeCount=${activeSlots.length}`);

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
        logger.info(`[disconnect] Game ${gameId} ended after disconnect - winner: ${gameEndResult.winner}`);
    } else {
        updatedGame = {
            ...game,
            worldConflictState: updatedStateData,
            lastMoveAt: Date.now()
        };
        logger.debug(`[disconnect] Game continues with remaining active players`);
    }

    await gameStorage.saveGame(updatedGame);
    await WebSocketNotifications.gameUpdate(updatedGame);

    return json({
        success: true,
        message: `Player ${player.name} disconnected and was eliminated`,
        playerName: player.name,
        gameEnded: shouldEndGame,
        winner: shouldEndGame ? gameEndResult.winner : undefined
    });
}

/**
 * Handle player reconnect - could be used for grace period logic in the future
 */
async function handlePlayerReconnect(
    gameId: string,
    playerId: string
): Promise<Response> {
    logger.debug(`[reconnect] Player ${playerId} reconnected to game ${gameId}`);
    return json({
        success: true,
        message: 'Reconnect acknowledged (not yet implemented)'
    });
}

/**
 * Handle player idle - could be used for timeout/inactivity logic
 */
async function handlePlayerIdle(
    gameId: string,
    playerId: string
): Promise<Response> {
    logger.debug(`[idle] Player ${playerId} idle in game ${gameId}`);
    return json({
        success: true,
        message: 'Idle acknowledged (not yet implemented)'
    });
}
