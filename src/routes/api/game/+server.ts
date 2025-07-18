import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { v4 as uuidv4 } from 'uuid';
import { validateCreateGameRequest } from '$lib/server/validation';
import { kvPutJSON } from '$lib/server/kv';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        const body = await request.json();
        const validation = validateCreateGameRequest(body);

        if (!validation.success) {
            return json({ error: validation.error }, { status: 400 });
        }

        const { playerName, gameType } = validation.data;

        // Create new game
        const gameId = uuidv4();
        const gameData = {
            gameId,
            status: 'PENDING',
            gameType,
            players: [{
                id: uuidv4(),
                name: playerName,
                joinedAt: Date.now()
            }],
            createdAt: Date.now(),
            lastUpdate: Date.now()
        };

        // Store in KV
        await kvPutJSON(platform, `game:${gameId}`, gameData);

        return json({ gameId, gameData });
    } catch (error) {
        console.error('Error creating game:', error);
        return json({ error: 'Failed to create game' }, { status: 500 });
    }
};
