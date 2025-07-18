import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateGameId, validateMoveRequest } from '$lib/server/validation';
import { kvGetJSON, kvPutJSON } from '$lib/server/kv';
import { GameNotifications } from '$lib/server/websocket';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameIdValidation = validateGameId(params.gameId);
        if (!gameIdValidation.success) {
            return json({ error: gameIdValidation.error }, { status: 400 });
        }

        const body = await request.json();
        const validation = validateMoveRequest(body);
        if (!validation.success) {
            return json({ error: validation.error }, { status: 400 });
        }

        const gameId = gameIdValidation.data;
        const { playerId, move } = validation.data;

        // Get current game data
        const gameData = await kvGetJSON(platform, `game:${gameId}`);

        if (!gameData) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Validate move
        if (gameData.status !== 'ACTIVE') {
            return json({ error: 'Game is not active' }, { status: 400 });
        }

        // Verify player is part of the game
        const player = gameData.players.find((p: any) => p.id === playerId);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Process move
        if (!gameData.moves) {
            gameData.moves = [];
        }

        const moveRecord = {
            playerId,
            move,
            timestamp: Date.now()
        };

        gameData.moves.push(moveRecord);
        gameData.lastUpdate = Date.now();

        // Check if game ended
        const isGameEnding = move.type === 'SURRENDER' || move.type === 'VICTORY';
        if (isGameEnding) {
            gameData.status = 'FINISHED';
            gameData.endedAt = Date.now();
        }

        // Update game in KV
        await kvPutJSON(platform, `game:${gameId}`, gameData);

        // Notify other players
        if (isGameEnding) {
            await GameNotifications.gameEnded(gameId, gameData, player);
        } else {
            await GameNotifications.gameStateChanged(gameId, gameData, moveRecord);
        }

        return json({ success: true, gameData });
    } catch (error) {
        console.error('Error processing move:', error);
        return json({ error: 'Failed to process move' }, { status: 500 });
    }
};
