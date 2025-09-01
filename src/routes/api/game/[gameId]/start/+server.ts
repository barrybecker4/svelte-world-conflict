import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/storage/GameStorage';
import { GameState } from '$lib/game/classes/GameState';
import { Region } from '$lib/game/classes/Region';
import { getErrorMessage } from '$lib/server/api-utils';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper';
import { GameNotifications } from '$lib/server/websocket';

/**
 * Start a pending multiplayer game
 * Forces the game to start even with open slots by filling them with AI players
 */
export const POST: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;

        const gameStorage = GameStorage.create(platform!);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game is not in pending state' }, { status: 400 });
        }

        const updatedPlayers = fillRemainingSlotsWithAI(game);

        console.log(`Starting game with ${updatedPlayers.length} players (${updatedPlayers.filter(p => !p.isAI).length} human)`);
        const regions = reconstructRegions(game.worldConflictState?.regions);

        // Initialize World Conflict game state with properly constructed regions
        const gameState = GameState.createInitialState(
            gameId,
            updatedPlayers,
            regions
        );

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            status: 'ACTIVE' as const,
            worldConflictState: gameState.toJSON(),
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify all connected clients
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        console.log(`✅ Game ${gameId} started with ${updatedPlayers.length} players`);

        return json({
            success: true,
            message: 'Game started successfully',
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            }
        });

    } catch (error) {
        console.error('Error starting game:', error);
        return json({
            error: 'Failed to start game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};

// Fill any remaining open slots with AI players
function fillRemainingSlotsWithAI(game: any): any[] {
  const updatedPlayers = [...game.players];

  while (updatedPlayers.length < GAME_CONSTANTS.MAX_PLAYERS) {
      updatedPlayers.push({
          index: updatedPlayers.length,
          name: updatedPlayers.name,
          isAI: true
      });
  }
  return updatedPlayers;
}

// Reconstruct regions from JSON data
function reconstructRegions(regionObjs: any[] | undefined): Region[] {
  let regions = [];
  if (regionObjs) {
      regions = regionObjs.map((regionObj: any) => {
          return new Region(regionObj);
      });

      console.log(`Reconstructed ${regions.length} regions as Region instances`);
  }
  return regions;
}