import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

export const GET: RequestHandler = async ({ platform }) => {

    const gameStorage = GameStorage.create(platform!);

    try {
        const waitingGames = await gameStorage.getGamesByStatus('PENDING');

        const now = Date.now();
        const validGames = waitingGames.filter(game =>
            (now - game.createdAt) < GAME_CONSTANTS.STALE_GAME_TIMEOUT_MS
        );

        const expiredGames = waitingGames.filter(game =>
          (now - game.createdAt) >= GAME_CONSTANTS.STALE_GAME_TIMEOUT_MS
        );

        cleanupOldGames(expiredGames, gameStorage);
        const openGames = getOpenGames(validGames, now);
        return json(openGames);

    } catch (error) {
        logger.error('Failed to get open games:', error);
        return json({ error: 'Failed to load games' }, { status: 500 });
    }
};

/**
 * Find the creator (first human player) of a game
 */
function getCreatorName(game: GameRecord): string {
    // The creator is the first human player (non-AI) in the game
    const humanPlayer = game.players.find(p => !p.isAI);
    return humanPlayer?.name || game.players[0]?.name || 'Unknown';
}

function getOpenGames(validGames: GameRecord[], now: number) {
  return validGames.map(game => ({
       gameId: game.gameId,
       creator: getCreatorName(game),
       playerCount: game.players.length,
       maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
       createdAt: game.createdAt,
       gameType: game.gameType || 'MULTIPLAYER',
       timeRemaining: Math.max(0, GAME_CONSTANTS.STALE_GAME_TIMEOUT_MS - (now - game.createdAt)), // Time until expiration
       pendingConfiguration: game.pendingConfiguration,
       players: game.players
  }));
}

// Clean up expired games from storage (helps keep storage clean)
async function cleanupOldGames(expiredGames: GameRecord[], gameStorage: GameStorage) {
    if (expiredGames.length > 0) {
        logger.debug(`Cleaning up ${expiredGames.length} expired games from storage`);
        for (const expiredGame of expiredGames) {
            try {
                await gameStorage.deleteGame(expiredGame.gameId);
                logger.debug(`Deleted expired game: ${expiredGame.gameId}`);
            } catch (error) {
                logger.error(`Failed to delete expired game ${expiredGame.gameId}:`, error);
            }
        }
    }
}
