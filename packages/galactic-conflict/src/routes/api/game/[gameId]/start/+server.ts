/**
 * API endpoint to start a pending game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { handleApiError, startGame } from '$lib/server/api-utils';

export const POST: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;
        const gameStorage = GameStorage.create(platform!);
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (gameRecord.status !== 'PENDING') {
            return json({ error: 'Game is already started or completed' }, { status: 400 });
        }

        if (!gameRecord.pendingConfiguration) {
            return json({ error: 'Game configuration not found' }, { status: 400 });
        }

        const startResult = await startGame(gameId, gameStorage);

        if (!startResult.success) {
            return json({ error: 'Failed to start game' }, { status: 500 });
        }

        return json({
            success: true,
            gameId,
            status: 'ACTIVE',
            gameState: startResult.gameState,
            message: 'Game started successfully',
        });

    } catch (error) {
        return handleApiError(error, 'starting game', { platform });
    }
};

