/**
 * API endpoint to send an armada from one planet to another
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { createArmada } from '$lib/game/entities/Armada';
import { handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from '@svelte-mp/framework/shared';
import { logger } from '$lib/game/utils/logger';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json();
        const { playerId, sourcePlanetId, destinationPlanetId, shipCount } = body;

        // Validate required fields
        if (playerId === undefined) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }
        if (sourcePlanetId === undefined) {
            return json({ error: 'Source planet ID is required' }, { status: 400 });
        }
        if (destinationPlanetId === undefined) {
            return json({ error: 'Destination planet ID is required' }, { status: 400 });
        }
        if (!shipCount || shipCount < 1) {
            return json({ error: 'Ship count must be at least 1' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord || !gameRecord.gameState) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (gameRecord.status !== 'ACTIVE') {
            return json({ error: 'Game is not active' }, { status: 400 });
        }

        const gameState = GalacticGameState.fromJSON(gameRecord.gameState);

        // Process any pending events first
        processGameState(gameState);

        // Validate the move
        const sourcePlanet = gameState.getPlanet(sourcePlanetId);
        const destinationPlanet = gameState.getPlanet(destinationPlanetId);

        if (!sourcePlanet) {
            return json({ error: 'Source planet not found' }, { status: 400 });
        }
        if (!destinationPlanet) {
            return json({ error: 'Destination planet not found' }, { status: 400 });
        }
        if (sourcePlanet.ownerId !== playerId) {
            return json({ error: 'You do not own the source planet' }, { status: 400 });
        }
        if (sourcePlanet.ships < shipCount) {
            return json({ error: 'Not enough ships on source planet' }, { status: 400 });
        }
        if (sourcePlanetId === destinationPlanetId) {
            return json({ error: 'Source and destination must be different' }, { status: 400 });
        }

        // Remove ships from source planet
        gameState.setPlanetShips(sourcePlanetId, sourcePlanet.ships - shipCount);

        // Create and add armada
        const armada = createArmada(
            playerId,
            shipCount,
            sourcePlanet,
            destinationPlanet,
            gameState.armadaSpeed
        );

        gameState.addArmada(armada);

        // Save updated state
        gameRecord.gameState = gameState.toJSON();
        await gameStorage.saveGame(gameRecord);

        // Notify other players
        await notifyGameUpdate(gameId, gameRecord.gameState);

        logger.debug(`Armada sent: ${shipCount} ships from planet ${sourcePlanetId} to ${destinationPlanetId}`);

        return json({
            success: true,
            armada,
            message: `Sent ${shipCount} ships from ${sourcePlanet.name} to ${destinationPlanet.name}`,
        });

    } catch (error) {
        return handleApiError(error, 'sending armada', { platform });
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

