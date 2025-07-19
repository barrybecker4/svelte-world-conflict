import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { WorldConflictGameStorage, WorldConflictKVStorage } from '$lib/storage/world-conflict/index.ts';

export const GET: RequestHandler = async ({ platform }) => {
    const kv = new WorldConflictKVStorage(platform!);
    const gameStorage = new WorldConflictGameStorage(kv);

    try {
        const waitingGames = await gameStorage.getGamesByStatus('PENDING');

        const openGames = waitingGames.map(game => ({
            gameId: game.gameId,
            creator: game.players[0]?.name || 'Unknown',
            playerCount: game.players.length,
            maxPlayers: 4,
            createdAt: game.createdAt,
            gameType: game.gameType || 'MULTIPLAYER'
        }));

        return json(openGames);
    } catch (error) {
        console.error('Failed to get open games:', error);
        return json({ error: 'Failed to load games' }, { status: 500 });
    }
};
