import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { handleApiError } from '$lib/server/api-utils';

interface RouteParams {
    gameId: string;
}

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'TIMEOUT' | 'DISCONNECT';
}

async function getGame(gameId: string, platform: App.Platform): Promise<GameRecord | null> {
    const gameStorage = GameStorage.create(platform!);
    return await gameStorage.getGame(gameId);
}

function getResponse(game: GameRecord) {
    console.log(`Loading game ${game.gameId}:`, {
        status: game.status,
        players: game.players?.length,
        hasWorldConflictState: !!game.worldConflictState,
        hasGameType: !!game.gameType,
        worldConflictStateKeys: game.worldConflictState ? Object.keys(game.worldConflictState) : []
    });

    const response = {
        gameId: game.gameId,
        status: game.status || 'ACTIVE',
        players: game.players || [],
        worldConflictState: game.worldConflictState || {},
        createdAt: game.createdAt || Date.now(),
        lastMoveAt: game.lastMoveAt || Date.now(),
        currentPlayerSlot: game.currentPlayerSlot || 0,
        gameType: game.gameType || 'AI' // Default to AI if not specified
    };

    if (!response.worldConflictState.regions) {
         console.error(`❌ Game ${game.gameId} missing regions in worldConflictState`);
         return json({ error: 'Game data is corrupted - missing regions' }, { status: 500 });
    }

    if (!response.worldConflictState.players) {
        console.error(`❌ Game ${game.gameId} missing players in worldConflictState`);
        return json({ error: 'Game data is corrupted - missing players' }, { status: 500 });
    }

    return response;
}

export const GET: RequestHandler = async ({ params, platform }) => {

    try {
        const { gameId } = params as RouteParams;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        const game = await getGame(gameId, platform!);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        const response = getResponse(game);
        return json(response);

    } catch (error) {
        return handleApiError(error, 'getting World Conflict game');
    }
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params as RouteParams;
        const { playerId, reason = 'RESIGN' } = await request.json() as QuitGameRequest;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const game = await getGame(gameId, platform!);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Mark player as quit and update game status
        const updatedGame = {
            ...game,
            status: 'COMPLETED' as const,
            lastMoveAt: Date.now()
        };

        const gameStorage = GameStorage.create(platform!);
        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotifications.gameUpdate(updatedGame);
        console.log(`Player ${playerId} quit game ${gameId} (${reason})`);

        return json({
            success: true,
            message: 'Successfully left the game'
        });

    } catch (error) {
        return handleApiError(error, 'quitting game');
    }
};
