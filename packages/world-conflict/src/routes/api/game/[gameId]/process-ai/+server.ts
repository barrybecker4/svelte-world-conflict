import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { handleApiError } from '$lib/server/api-utils';
import { processAiTurns } from '$lib/server/ai/AiTurnProcessor';
import { logger } from 'multiplayer-framework/shared';

/**
 * Trigger AI turn processing for a game
 * Called by clients after they've loaded initial state and connected to WebSocket
 */
export const POST: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;

        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);

        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'ACTIVE') {
            return json({ error: 'Game is not active' }, { status: 400 });
        }

        const gameState = new GameState(game.worldConflictState);
        const currentPlayer = gameState.getCurrentPlayer();

        // Only process if current player is AI
        if (!currentPlayer?.isAI) {
            return json({
                success: true,
                message: 'Current player is not AI, no processing needed',
                currentPlayerSlot: gameState.currentPlayerSlot
            });
        }

        logger.debug(`Processing AI turns for game ${gameId}, starting with ${currentPlayer.name}`);

        // Process AI turns until we reach a human player
        const processedGameState = await processAiTurns(gameState, gameStorage, gameId, platform);

        return json({
            success: true,
            currentPlayerSlot: processedGameState.currentPlayerSlot,
            message: 'AI turns processed successfully'
        });
    } catch (error) {
        return handleApiError(error, `processing AI turns for game ${params.gameId}`);
    }
};
