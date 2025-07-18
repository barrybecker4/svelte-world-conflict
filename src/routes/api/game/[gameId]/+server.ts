import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateGameId } from '$lib/server/validation';
import { kvGetJSON } from '$lib/server/kv';

export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        const gameIdValidation = validateGameId(params.gameId);

        if (!gameIdValidation.success) {
            return json({ error: gameIdValidation.error }, { status: 400 });
        }

        const gameId = gameIdValidation.data;
        const gameData = await kvGetJSON(platform, `game:${gameId}`);

        if (!gameData) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        return json({ gameData });
    } catch (error) {
        console.error('Error fetching game:', error);
        return json({ error: 'Failed to fetch game' }, { status: 500 });
    }
};
