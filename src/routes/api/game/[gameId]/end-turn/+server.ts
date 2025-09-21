import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { EndTurnCommand, CommandProcessor } from '$lib/game/commands';
import { WebSocketNotificationHelper } from '$lib/server/websocket/WebSocketNotificationHelper';
import { getErrorMessage } from '$lib/server/api-utils';
import { processAiTurns } from '$lib/server/ai/AiTurnProcessor';

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

        const gameStorage = GameStorage.create(platform!);

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

        const gameState = new GameState(game.worldConflictState);

        const currentTurnPlayer = gameState.players.find(p => p.index === gameState.playerIndex);
        if (!currentTurnPlayer || currentTurnPlayer.index !== playerIndex) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }
        else {
          console.log(`currentTurnPlayer.index = ${currentTurnPlayer.index}, game.currentPlayerIndex = ${game.currentPlayerIndex}`);
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.index === playerIndex);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Execute the human player's end turn command
        const endTurnCommand = new EndTurnCommand(gameState, player);
        const commandProcessor = new CommandProcessor();
        const result = commandProcessor.process(endTurnCommand);

        if (!result.success) {
            return json({ error: result.error || 'Failed to end turn' }, { status: 400 });
        }

        let finalGameState = result.newState!;

        // Process AI turns if the next player(s) are AI
        finalGameState = await processAiTurns(finalGameState, gameStorage, gameId, platform);

        // Update the game record with the final state
        const updatedGame = {
            ...game,
            worldConflictState: finalGameState.toJSON(),
            currentPlayerIndex: finalGameState.playerIndex,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!.env);

        console.log(`Turn processing completed, current player: ${finalGameState.playerIndex}`);

        return json({
            success: true,
            gameState: finalGameState.toJSON(),
            message: 'Turn ended successfully',
            turnTransition: true
        });

    } catch (error) {
        console.error(`Error ending turn in game ${params.gameId}:`, error);
        return json({ error: 'Failed to end turn: ' + getErrorMessage(error) }, { status: 500 });
    }
};
