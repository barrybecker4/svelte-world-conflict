import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { EndTurnCommand, CommandProcessor } from '$lib/game/classes/Command.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import { getErrorMessage } from '$lib/server/api-utils.ts';

interface EndTurnRequest {
    playerId: string;
}


export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId } = await request.json() as EndTurnRequest;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!.env.WORLD_CONFLICT_KV);
        const gameStorage = new WorldConflictGameStorage(kv);

        // Load the current game
        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Parse playerId as integer to get player index
        const playerIndex = parseInt(playerId);
        if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 3) {
            return json({ error: `Invalid player ID: ${playerId}` }, { status: 400 });
        }

        // Verify it's the player's turn using player index
        if (game.currentPlayerIndex !== playerIndex) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.index === playerIndex);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Create game state instance
        const gameState = new WorldConflictGameState(game.worldConflictState);

        const endTurnCommand = new EndTurnCommand(gameState, player);
        const commandProcessor = new CommandProcessor();

        // Execute the command
        const result = commandProcessor.process(endTurnCommand);

        if (!result.success) {
            return json({ error: result.error || 'Failed to end turn' }, { status: 400 });
        }

        // Update the game record with the new state
        const updatedGame = {
            ...game,
            worldConflictState: result.newState!.toJSON(),
            currentPlayerIndex: result.newState!.playerIndex,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!.env);

        console.log(`Player ${playerIndex} (${player.name}) ended their turn in game ${gameId}`);

        return json({
            success: true,
            gameState: result.newState!.toJSON(),
            message: 'Turn ended successfully'
        });

    } catch (error) {
        console.error(`Error ending turn in game ${params.gameId}:`, error);
        return json({ error: 'Failed to end turn: ' + getErrorMessage(error) }, { status: 500 });
    }
};
