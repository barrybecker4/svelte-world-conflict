import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player } from '$lib/game/WorldConflictGameState.ts';

interface StartGameRequest {
    playerId: string; // The ID of the player requesting to start (must be creator)
}

/**
 * Start a PENDING game anyway, filling any empty slots with AI players
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId } = await request.json() as StartGameRequest;

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game is not in a startable state' }, { status: 400 });
        }

        // Verify that the requesting player is the game creator (first player)
        const creator = game.players[0];
        if (!creator || creator.index.toString() !== playerId) {
            return json({ error: 'Only the game creator can start the game' }, { status: 403 });
        }

        // Fill empty slots with AI players
        const maxPlayers = 4;
        const currentPlayerCount = game.players.length;
        const aiPlayerNames = ['AI Easy', 'AI Normal', 'AI Hard', 'AI Expert'];
        const aiLevels = [0, 1, 2, 3]; // Nice, Rude, Mean, Evil

        for (let i = currentPlayerCount; i < maxPlayers; i++) {
            const aiPlayer: Player = {
                id: `ai_${i}_${Date.now()}`,
                name: aiPlayerNames[i] || `AI Player ${i + 1}`,
                color: getPlayerColor(i),
                isAI: true,
                index: i,
                aiLevel: aiLevels[i % aiLevels.length]
            };
            game.players.push(aiPlayer);
        }

        // Change status to ACTIVE
        game.status = 'ACTIVE';
        game.lastMoveAt = Date.now();

        // Initialize World Conflict game state with all players (human + AI)
        const gameState = WorldConflictGameState.createInitialState(
            gameId,
            game.players,
            game.worldConflictState.regions || []
        );

        game.worldConflictState = gameState.toJSON();

        await gameStorage.saveGame(game);

        // Notify all connected players that the game has started
        await WebSocketNotificationHelper.sendGameUpdate(game, platform!);

        return json({
            success: true,
            game: {
                gameId: game.gameId,
                status: game.status,
                players: game.players,
                message: 'Game started with AI players filling empty slots'
            }
        });

    } catch (error) {
        console.error('Error starting game:', error);
        return json({
            error: 'Failed to start game',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};

/**
 * Helper function to get player colors
 */
function getPlayerColor(index: number): string {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']; // Red, Blue, Green, Orange
    return colors[index] || '#95a5a6'; // Default gray
}
