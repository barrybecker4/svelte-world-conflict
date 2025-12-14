/**
 * API endpoint to join a pending game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { createPlayer, handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl, buildWebSocketUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';

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
        await notifyPlayerJoined(gameId, player);

        // Auto-start the game if all slots are filled
        if (canStart) {
            logger.info(`All slots filled - auto-starting game ${gameId}`);
            const startResult = await autoStartGame(gameId, gameStorage);
            
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

async function autoStartGame(gameId: string, gameStorage: GameStorage): Promise<{ success: boolean; gameState?: any }> {
    try {
        const gameRecord = await gameStorage.loadGame(gameId);
        
        if (!gameRecord || gameRecord.status !== 'PENDING' || !gameRecord.pendingConfiguration) {
            return { success: false };
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

        logger.info(`Game ${gameId} auto-started with ${gameRecord.players.length} players`);

        return { success: true, gameState: gameRecord.gameState };
    } catch (error) {
        logger.error(`Failed to auto-start game ${gameId}:`, error);
        return { success: false };
    }
}

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

