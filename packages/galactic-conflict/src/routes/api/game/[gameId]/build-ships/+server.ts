/**
 * API endpoint to build ships at a planet
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, VersionConflictError } from '$lib/server/storage/GameStorage';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { loadActiveGame, saveAndNotify, withRetry } from '$lib/server/api-utils';
import { logger } from 'multiplayer-framework/shared';

interface BuildShipsRequest {
    playerId: number;
    planetId: number;
    shipCount: number;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json() as BuildShipsRequest;
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
        
        const result = await withRetry(async () => {
            const { gameRecord, gameState, expectedLastUpdateAt } = await loadActiveGame(gameStorage, gameId);

            // Validate the build (these are NOT retryable - they throw regular Errors)
            const planet = gameState.getPlanet(planetId);

            if (!planet) {
                throw new Error('Planet not found');
            }
            if (planet.ownerId !== playerId) {
                throw new Error('You do not own this planet');
            }

            // Calculate cost
            const totalCost = shipCount * GALACTIC_CONSTANTS.SHIP_COST;

            // Check player's global resources
            const playerResources = gameState.getPlayerResources(playerId);
            if (playerResources < totalCost) {
                throw new Error(`Not enough resources. Need ${totalCost}, have ${Math.floor(playerResources)}`);
            }

            // Spend resources from player's global pool and add ships to planet
            gameState.spendPlayerResources(playerId, totalCost);
            gameState.addPlanetShips(planetId, shipCount);

            // Save updated state and notify
            await saveAndNotify(gameId, gameRecord, gameState, gameStorage, expectedLastUpdateAt);

            const updatedPlanet = gameState.getPlanet(planetId);
            const newPlayerResources = gameState.getPlayerResources(playerId);
            logger.debug(`Built ${shipCount} ships at planet ${planetId}, cost: ${totalCost}, remaining resources: ${newPlayerResources}`);

            return {
                newShipCount: updatedPlanet?.ships,
                newPlayerResources: newPlayerResources,
                planetName: planet.name,
                cost: totalCost,
            };
        }, { operationName: 'build-ships' });

        return json({
            success: true,
            newShipCount: result.newShipCount,
            newPlayerResources: result.newPlayerResources,
            message: `Built ${shipCount} ships at ${result.planetName} for ${result.cost} resources`,
        });

    } catch (error) {
        // Version conflict - server was busy, client should retry
        if (error instanceof VersionConflictError) {
            return json({ error: 'Server busy - please try again' }, { status: 409 });
        }
        // Validation or other known errors - return as 400
        if (error instanceof Error) {
            logger.warn(`Build ships failed: ${error.message}`);
            return json({ error: error.message }, { status: 400 });
        }
        // Unknown error
        logger.error('Build ships unknown error:', error);
        return json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
};

