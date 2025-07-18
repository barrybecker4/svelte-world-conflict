import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { validateGameId, validateJoinGameRequest } from '$lib/server/validation';
import { kvGetJSON, kvPutJSON } from '$lib/server/kv';
import { GameNotifications } from '$lib/server/websocket';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameIdValidation = validateGameId(params.gameId);
        if (!gameIdValidation.success) {
            return json({ error: gameIdValidation.error }, { status: 400 });
        }

        const body = await request.json();
        const validation = validateJoinGameRequest(body);
        if (!validation.success) {
            return json({ error: validation.error }, { status: 400 });
        }

        const gameId = gameIdValidation.data;
        const { playerName } = validation.data;

        // Get current game data
        const gameData = await kvGetJSON(platform, `game:${gameId}`);

        if (!gameData) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Check if game is joinable
        if (gameData.status !== 'PENDING') {
            return json({ error: 'Game is not joinable' }, { status: 400 });
        }

        if (gameData.players.length >= 4) {
            return json({ error: 'Game is full' }, { status: 400 });
        }

        // Check if player name is already taken
        if (gameData.players.some((p: any) => p.name === playerName)) {
            return json({ error: 'Player name is already taken' }, { status: 400 });
        }

        // Add new player
        const newPlayer = {
            id: uuidv4(),
            name: playerName,
            joinedAt: Date.now()
        };

        gameData.players.push(newPlayer);
        gameData.lastUpdate = Date.now();

        // Start game when we have 2+ players
        if (gameData.players.length >= 2) {
            gameData.status = 'ACTIVE';
            gameData.startedAt = Date.now();
        }

        // Update game in KV
        await kvPutJSON(platform, `game:${gameId}`, gameData);

        // Notify other players via WebSocket
        if (gameData.status === 'ACTIVE') {
            await GameNotifications.gameStarted(gameId, gameData);
        } else {
            await GameNotifications.playerJoined(gameId, newPlayer, gameData);
        }

        return json({
            playerId: newPlayer.id,
            gameData
        });
    } catch (error) {
        console.error('Error joining game:', error);
        return json({ error: 'Failed to join game' }, { status: 500 });
    }
};
