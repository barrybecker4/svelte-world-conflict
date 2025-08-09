import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { WorldConflictGameStorage, WorldConflictKVStorage } from '$lib/storage/index.ts';

export const GET: RequestHandler = async ({ platform }) => {
    const kv = new WorldConflictKVStorage(platform!);
    const gameStorage = new WorldConflictGameStorage(kv);

    try {
        const waitingGames = await gameStorage.getGamesByStatus('PENDING');

        // Filter out expired games (older than 20 minutes)
        const TWENTY_MINUTES = 20 * 60 * 1000;
        const now = Date.now();
        const validGames = waitingGames.filter(game =>
            (now - game.createdAt) < TWENTY_MINUTES
        );

        // Clean up expired games from storage (optional - helps keep storage clean)
        const expiredGames = waitingGames.filter(game =>
            (now - game.createdAt) >= TWENTY_MINUTES
        );

        if (expiredGames.length > 0) {
            console.log(`🧹 Cleaning up ${expiredGames.length} expired games from storage`);
            for (const expiredGame of expiredGames) {
                try {
                    await gameStorage.deleteGame(expiredGame.gameId);
                    console.log(`🗑️  Deleted expired game: ${expiredGame.gameId}`);
                } catch (error) {
                    console.error(`❌ Failed to delete expired game ${expiredGame.gameId}:`, error);
                }
            }
        }

        const openGames = validGames.map(game => ({
            gameId: game.gameId,
            creator: game.players[0]?.name || 'Unknown',
            playerCount: game.players.length,
            maxPlayers: 4,
            createdAt: game.createdAt,
            gameType: game.gameType || 'MULTIPLAYER',
            timeRemaining: Math.max(0, TWENTY_MINUTES - (now - game.createdAt)) // Time until expiration
        }));

        console.log(`📋 Returning ${openGames.length} open games (filtered out ${expiredGames.length} expired games)`);

        return json(openGames);
    } catch (error) {
        console.error('Failed to get open games:', error);
        return json({ error: 'Failed to load games' }, { status: 500 });
    }
};
