/**
 * API endpoint to get game state
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';

export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;
        const gameStorage = GameStorage.create(platform!);
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // For PENDING games, return the pending configuration
        if (gameRecord.status === 'PENDING') {
            return json({
                gameId: gameRecord.gameId,
                status: gameRecord.status,
                players: gameRecord.players.map(p => ({ slotIndex: p.slotIndex, name: p.name })),
                pendingConfiguration: gameRecord.pendingConfiguration,
                createdAt: gameRecord.createdAt,
            });
        }

        // For ACTIVE games, process events and return current state
        if (gameRecord.status === 'ACTIVE' && gameRecord.gameState) {
            const gameState = GalacticGameState.fromJSON(gameRecord.gameState);
            
            // Track if we had battle replays before processing
            const replaysBefore = gameState.recentBattleReplays.length;
            
            // Process any pending events (this may create battle replays)
            processGameState(gameState);

            // Save updated state
            gameRecord.gameState = gameState.toJSON();
            await gameStorage.saveGame(gameRecord);
            
            // If new battle replays were created, broadcast to all clients
            const replaysAfter = gameRecord.gameState.recentBattleReplays?.length ?? 0;
            if (replaysAfter > replaysBefore) {
                console.log(`[GET /game] Broadcasting ${replaysAfter - replaysBefore} new battle replays`);
                await notifyGameUpdate(gameId, gameRecord.gameState);
            }

            return json({
                gameId: gameRecord.gameId,
                status: gameRecord.status,
                gameState: gameRecord.gameState,
            });
        }

        // COMPLETED games
        return json({
            gameId: gameRecord.gameId,
            status: gameRecord.status,
            gameState: gameRecord.gameState,
        });

    } catch (error) {
        return handleApiError(error, 'getting game', { platform });
    }
};

async function notifyGameUpdate(gameId: string, gameState: any): Promise<void> {
    try {
        const isLocal = isLocalDevelopment();
        const workerUrl = getWorkerHttpUrl(isLocal);

        await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId,
                message: {
                    type: 'gameUpdate',
                    gameId,
                    gameState,
                },
            }),
        });
    } catch (error) {
        logger.warn('Failed to notify game update:', error);
    }
}

