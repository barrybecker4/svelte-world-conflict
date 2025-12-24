/**
 * API endpoint to join a pending game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { createPlayer, handleApiError, startGame } from '$lib/server/api-utils';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { logger } from 'multiplayer-framework/shared';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json() as { playerName?: string; slotIndex?: number };
        const { playerName, slotIndex } = body;

        if (!playerName?.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        if (slotIndex === undefined || slotIndex === null) {
            return json({ error: 'Slot index is required' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);
        let gameRecord = await gameStorage.loadGame(gameId);

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
        await WebSocketNotifications.playerJoined(gameId, player);

        // Auto-start the game if all slots are filled
        if (canStart) {
            logger.info(`All slots filled - auto-starting game ${gameId}`);
            const startResult = await startGame(gameId, gameStorage);

            if (startResult.success) {
                return json({
                    success: true,
                    player,
                    gameStarted: true,
                    gameState: startResult.gameState,
                    message: `Joined and started game ${gameId}`,
                });
            }
        }

        return json({
            success: true,
            player,
            canStart,
            gameStarted: false,
            message: `Joined game ${gameId} at slot ${slotIndex}`,
        });

    } catch (error) {
        return handleApiError(error, 'joining game', { platform });
    }
};

