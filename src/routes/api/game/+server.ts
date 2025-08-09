import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/world-conflict/index.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';

interface RouteParams {
    gameId: string;
}

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'TIMEOUT' | 'DISCONNECT';
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

async function getGame(gameId: string, platform: App.Platform): Promise<WorldConflictGameRecord | null> {
    const kv = new WorldConflictKVStorage(platform);
    const gameStorage = new WorldConflictGameStorage(kv);
    return await gameStorage.getGame(gameId);
}

function getResponse(game: WorldConflictGameRecord) {
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
        currentPlayerIndex: game.currentPlayerIndex || 0,
        gameType: game.gameType || 'AI' // Default to AI if not specified
    };

    if (!response.worldConflictState.regions) {
         console.error(`❌ Game ${gameId} missing regions in worldConflictState`);
         return json({ error: 'Game data is corrupted - missing regions' }, { status: 500 });
    }

     if (!response.worldConflictState.players) {
         console.error(`❌ Game ${gameId} missing players in worldConflictState`);
         return json({ error: 'Game data is corrupted - missing players' }, { status: 500 });
     }

     console.log(`✅ Returning game data for ${gameId}:`, {
         regions: response.worldConflictState.regions?.length,
         players: response.worldConflictState.players?.length,
         owners: Object.keys(response.worldConflictState.owners || {}).length,
         soldiers: Object.keys(response.worldConflictState.soldiersByRegion || {}).length
     });

    return response;
}

export const GET: RequestHandler = async ({ params, platform }) => {

    try {
        const { gameId } = params as RouteParams;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        const game = await getGame(gameId, platform);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        const response = getResponse(game);
        return json(response);

    } catch (error) {
        console.error(`Error getting World Conflict game ${params.gameId}:`, error);
        return json({ error: 'Failed to load game: ' + getErrorMessage(error) }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
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

        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);
        console.log(`Player ${playerId} quit game ${gameId} (${reason})`);

        return json({
            success: true,
            message: 'Successfully left the game'
        });

    } catch (error) {
        console.error(`Error quitting game. Could not get gameId from ${params}:`, error);
        return json({ error: 'Failed to quit game: ' + getErrorMessage(error) }, { status: 500 });
    }
};
