import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { KVStorage } from '$lib/storage/kv.ts';
import { GameStorage } from '$lib/storage/games.ts';

export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;

        const kv = new KVStorage(platform!);
        const gameStorage = new GameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        return json({
            gameId: game.gameId,
            players: game.players,
            status: game.status,
            worldConflictState: game.worldConflictState,
            createdAt: game.createdAt,
            lastMoveAt: game.lastMoveAt
        });
    } catch (error) {
        console.error('Error in /api/game/[gameId]:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
