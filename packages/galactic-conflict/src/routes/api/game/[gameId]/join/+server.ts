/**
 * API endpoint to join a pending game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { createPlayer, handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl, buildWebSocketUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from '@svelte-mp/framework/shared';
import { logger } from '$lib/game/utils/logger';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json();
        const { playerName, slotIndex } = body;

        if (!playerName?.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        if (slotIndex === undefined || slotIndex === null) {
            return json({ error: 'Slot index is required' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (gameRecord.status !== 'PENDING') {
            return json({ error: 'Game is not accepting new players' }, { status: 400 });
        }

        // Create player and add to game
        const player = createPlayer(playerName.trim(), slotIndex, false);
        const success = await gameStorage.addPlayerToGame(gameId, player, slotIndex);

        if (!success) {
            return json({ error: 'Failed to join game - slot may be taken' }, { status: 400 });
        }

        // Check if game can now start (all slots filled)
        const canStart = await gameStorage.canGameStart(gameId);

        // Notify other players via WebSocket
        await notifyPlayerJoined(gameId, player);

        return json({
            success: true,
            player,
            canStart,
            message: `Joined game ${gameId} at slot ${slotIndex}`,
        });

    } catch (error) {
        return handleApiError(error, 'joining game', { platform });
    }
};

async function notifyPlayerJoined(gameId: string, player: any): Promise<void> {
    try {
        const isLocal = isLocalDevelopment();
        const workerUrl = getWorkerHttpUrl(isLocal);

        await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId,
                message: {
                    type: 'playerJoined',
                    gameId,
                    player,
                },
            }),
        });
    } catch (error) {
        logger.warn('Failed to notify player joined:', error);
    }
}

