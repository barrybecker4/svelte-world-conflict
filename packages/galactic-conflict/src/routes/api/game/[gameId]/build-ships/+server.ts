/**
 * API endpoint to build ships at a planet
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from '$lib/game/utils/logger';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json();
        const { playerId, planetId, shipCount } = body;

        // Validate required fields
        if (playerId === undefined) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }
        if (planetId === undefined) {
            return json({ error: 'Planet ID is required' }, { status: 400 });
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

        // Validate the build
        const planet = gameState.getPlanet(planetId);

        if (!planet) {
            return json({ error: 'Planet not found' }, { status: 400 });
        }
        if (planet.ownerId !== playerId) {
            return json({ error: 'You do not own this planet' }, { status: 400 });
        }

        // Calculate cost
        const totalCost = shipCount * GALACTIC_CONSTANTS.SHIP_COST;

        if (planet.resources < totalCost) {
            return json({ 
                error: `Not enough resources. Need ${totalCost}, have ${planet.resources}` 
            }, { status: 400 });
        }

        // Spend resources and add ships
        gameState.spendPlanetResources(planetId, totalCost);
        gameState.addPlanetShips(planetId, shipCount);

        // Save updated state
        gameRecord.gameState = gameState.toJSON();
        await gameStorage.saveGame(gameRecord);

        // Notify other players
        await notifyGameUpdate(gameId, gameRecord.gameState);

        const updatedPlanet = gameState.getPlanet(planetId);
        logger.debug(`Built ${shipCount} ships at planet ${planetId}, cost: ${totalCost}`);

        return json({
            success: true,
            newShipCount: updatedPlanet?.ships,
            newResourceCount: updatedPlanet?.resources,
            message: `Built ${shipCount} ships at ${planet.name} for ${totalCost} resources`,
        });

    } catch (error) {
        return handleApiError(error, 'building ships', { platform });
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

