/**
 * API endpoint to start a pending game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from '@svelte-mp/framework/shared';
import { logger } from '$lib/game/utils/logger';

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

        // Create game state from pending configuration
        const gameState = GalacticGameState.createInitialState(
            gameId,
            gameRecord.pendingConfiguration.playerSlots,
            gameRecord.pendingConfiguration.settings!,
            `seed-${gameId}`
        );

        // Update game record
        gameRecord.status = 'ACTIVE';
        gameRecord.gameState = gameState.toJSON();
        gameRecord.players = gameState.players;
        delete gameRecord.pendingConfiguration;

        await gameStorage.saveGame(gameRecord);

        // Notify all players via WebSocket
        await notifyGameStarted(gameId, gameRecord.gameState);

        logger.info(`Game ${gameId} started with ${gameRecord.players.length} players`);

        return json({
            success: true,
            gameId,
            status: 'ACTIVE',
            gameState: gameRecord.gameState,
            message: 'Game started successfully',
        });

    } catch (error) {
        return handleApiError(error, 'starting game', { platform });
    }
};

async function notifyGameStarted(gameId: string, gameState: any): Promise<void> {
    try {
        const isLocal = isLocalDevelopment();
        const workerUrl = getWorkerHttpUrl(isLocal);

        await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId,
                message: {
                    type: 'gameStarted',
                    gameId,
                    gameState,
                },
            }),
        });
    } catch (error) {
        logger.warn('Failed to notify game started:', error);
    }
}

