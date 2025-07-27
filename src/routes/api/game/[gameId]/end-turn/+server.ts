import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { EndTurnCommand, CommandProcessor } from '$lib/game/classes/Command.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';

interface EndTurnRequest {
    playerId: string;
}

/**
 * Helper function to safely get error message
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
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

        // Verify it's the player's turn
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== playerId) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }

        // Create game state instance
        const gameState = new WorldConflictGameState(game.worldConflictState);

        // Create and execute end turn command
        const endTurnCommand = new EndTurnCommand();
        const commandProcessor = new CommandProcessor();

        // Execute the command
        const result = commandProcessor.executeCommand(gameState, endTurnCommand);

        if (!result.success) {
            return json({ error: result.error || 'Failed to end turn' }, { status: 400 });
        }

        // Update the game record
        const updatedGame = {
            ...game,
            worldConflictState: gameState.getStateData(),
            currentPlayerIndex: gameState.playerIndex,
            lastMoveAt: Date.now()
        };

        // Save the updated game
        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!.env);

        console.log(`Player ${playerId} ended their turn in game ${gameId}`);

        return json({
            success: true,
            gameState: gameState.getStateData(),
            message: 'Turn ended successfully'
        });

    } catch (error) {
        console.error(`Error ending turn in game ${params.gameId}:`, error);
        return json({ error: 'Failed to end turn: ' + getErrorMessage(error) }, { status: 500 });
    }
};
