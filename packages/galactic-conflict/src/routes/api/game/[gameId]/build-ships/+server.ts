/**
 * API endpoint to build ships at a planet
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { handleApiError, loadActiveGame, saveAndNotify, withRetry } from '$lib/server/api-utils';
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
        
        try {
            const result = await withRetry(async () => {
                const { gameRecord, gameState, expectedLastUpdateAt } = await loadActiveGame(gameStorage, gameId);

                // Validate the build
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
                    message: `Built ${shipCount} ships at ${planet.name} for ${totalCost} resources`,
                };
            }, { operationName: 'building ships' });

            return json({
                success: true,
                ...result,
            });
        } catch (error) {
            // Handle validation errors with 400 status
            if (error instanceof Error && !error.message.includes('Game state was modified')) {
                return json({ error: error.message }, { status: 400 });
            }
            // Handle version conflict with 409 status
            if (error instanceof Error && error.message.includes('Game state was modified')) {
                return json({ error: error.message }, { status: 409 });
            }
            throw error;
        }

    } catch (error) {
        return handleApiError(error, 'building ships', { platform });
    }
};

