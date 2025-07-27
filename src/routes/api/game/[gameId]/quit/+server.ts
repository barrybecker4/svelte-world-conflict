import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateGameId } from '$lib/server/validation';
import { GameNotifications } from '$lib/server/websocket';
import { WorldConflictKVStorage } from '$lib/storage/world-conflict';

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'DISCONNECT' | 'TIMEOUT';
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const kv = new WorldConflictKVStorage(platform!);

        const gameIdValidation = validateGameId(params.gameId);
        if (!gameIdValidation.success) {
            return json({ error: gameIdValidation.error }, { status: 400 });
        }

        const body = await request.json() as QuitGameRequest;
        const { playerId, reason = 'RESIGN' } = body;

        if (!playerId || typeof playerId !== 'string') {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const gameId = gameIdValidation.data;
        const gameDataRaw = await kv.get(`game:${gameId}`);

        if (!gameDataRaw) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        const gameData = JSON.parse(gameDataRaw);

        // Find the player
        const playerIndex = gameData.players.findIndex((p: any) => p.id === playerId);
        if (playerIndex === -1) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        const player = gameData.players[playerIndex];

        // Remove player or mark as quit
        if (gameData.status === 'PENDING') {
            // Remove player from pending game
            gameData.players.splice(playerIndex, 1);
        } else {
            // Mark player as quit in active game
            player.quitAt = Date.now();
            player.quitReason = reason;
        }

        gameData.lastUpdate = Date.now();

        // End game if not enough players remain
        const activePlayers = gameData.players.filter((p: any) => !p.quitAt);
        if (activePlayers.length < 2 && gameData.status === 'ACTIVE') {
            gameData.status = 'FINISHED';
            gameData.endedAt = Date.now();
            gameData.endReason = 'INSUFFICIENT_PLAYERS';
        }

        // Update game in KV
        await kv.put(`game:${gameId}`, JSON.stringify(gameData));

        // Notify other players
        if (gameData.status === 'FINISHED') {
            await GameNotifications.gameEnded(gameId, gameData);
        } else {
            await GameNotifications.playerLeft(gameId, playerId, gameData);
        }

        return json({ success: true, gameData });
    } catch (error) {
        console.error('Error processing quit:', error);
        return json({ error: 'Failed to process quit' }, { status: 500 });
    }
};
