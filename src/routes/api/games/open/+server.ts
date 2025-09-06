import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

const TWENTY_MINUTES = 30 * 60 * 1000;
const OLD_GAMES_THRESHOLD = TWENTY_MINUTES;

export const GET: RequestHandler = async ({ platform }) => {

    const gameStorage = GameStorage.create(platform!);

    try {
        const waitingGames = await gameStorage.getGamesByStatus('PENDING');

        const now = Date.now();
        const validGames = waitingGames.filter(game =>
            (now - game.createdAt) < OLD_GAMES_THRESHOLD
        );

        const expiredGames = waitingGames.filter(game =>
          (now - game.createdAt) >= OLD_GAMES_THRESHOLD
        );

        cleanupOldGames(expiredGames);
        const openGames = getOpenGames(validGames);
        return json(openGames);

    } catch (error) {
        console.error('Failed to get open games:', error);
        return json({ error: 'Failed to load games' }, { status: 500 });
    }
};


function getOpenGames(validGames) {
  return validGames.map(game => ({
       gameId: game.gameId,
       creator: game.players[0]?.name || 'Unknown',
       playerCount: game.players.length,
       maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
       createdAt: game.createdAt,
       gameType: game.gameType || 'MULTIPLAYER',
       timeRemaining: Math.max(0, OLD_GAMES_THRESHOLD - (now - game.createdAt)) // Time until expiration
  }));
}

// Clean up expired games from storage (helps keep storage clean)
async function cleanupOldGames(expiredGames) {
    if (expiredGames.length > 0) {
        console.log(`Cleaning up ${expiredGames.length} expired games from storage`);
        for (const expiredGame of expiredGames) {
            try {
                await gameStorage.deleteGame(expiredGame.gameId);
                console.log(`Deleted expired game: ${expiredGame.gameId}`);
            } catch (error) {
                console.error(`Failed to delete expired game ${expiredGame.gameId}:`, error);
            }
        }
    }
}

