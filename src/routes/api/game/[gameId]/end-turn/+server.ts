import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { EndTurnCommand, CommandProcessor } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { getErrorMessage } from '$lib/server/api-utils';
import { processAiTurns } from '$lib/server/ai/AiTurnProcessor';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

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
        const playerSlotIndex = parseInt(playerId);
        if (isNaN(playerSlotIndex) || playerSlotIndex < 0 || playerSlotIndex >= GAME_CONSTANTS.MAX_PLAYERS) {
            return json({ error: `Invalid player ID: ${playerId}` }, { status: 400 });
        }

        const gameState = new GameState(game.worldConflictState);

        const currentTurnPlayer = gameState.players.find(p => p.slotIndex === gameState.currentPlayerSlot);
        if (!currentTurnPlayer || currentTurnPlayer.slotIndex !== playerSlotIndex) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }
        else {
          console.log(`currentTurnPlayer.slotIndex = ${currentTurnPlayer.slotIndex}, game.currentPlayerSlot = ${game.currentPlayerSlot}`);
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);
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
            currentPlayerSlot: finalGameState.currentPlayerSlot,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotifications.gameUpdate(updatedGame, platform!.env);

        console.log(`Turn processing completed, current player slot: ${finalGameState.currentPlayerSlot}`);

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
