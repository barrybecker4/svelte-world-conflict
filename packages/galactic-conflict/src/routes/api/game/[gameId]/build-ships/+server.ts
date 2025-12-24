/**
 * API endpoint to build ships at a planet
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, VersionConflictError } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { handleApiError } from '$lib/server/api-utils';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
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
        
        // Retry logic for optimistic locking
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const gameRecord = await gameStorage.loadGame(gameId);

                if (!gameRecord || !gameRecord.gameState) {
                    return json({ error: 'Game not found' }, { status: 404 });
                }

                if (gameRecord.status !== 'ACTIVE') {
                    return json({ error: 'Game is not active' }, { status: 400 });
                }

                // Store the version we're working with
                const expectedLastUpdateAt = gameRecord.lastUpdateAt;

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

                // Check player's global resources
                const playerResources = gameState.getPlayerResources(playerId);
                if (playerResources < totalCost) {
                    return json({
                        error: `Not enough resources. Need ${totalCost}, have ${Math.floor(playerResources)}`
                    }, { status: 400 });
                }

                // Spend resources from player's global pool and add ships to planet
                gameState.spendPlayerResources(playerId, totalCost);
                gameState.addPlanetShips(planetId, shipCount);

                // Save updated state with optimistic locking
                gameRecord.gameState = gameState.toJSON();
                await gameStorage.saveGame(gameRecord, expectedLastUpdateAt);

                // Notify other players
                await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);

                const updatedPlanet = gameState.getPlanet(planetId);
                const newPlayerResources = gameState.getPlayerResources(playerId);
                logger.debug(`Built ${shipCount} ships at planet ${planetId}, cost: ${totalCost}, remaining resources: ${newPlayerResources}`);

                return json({
                    success: true,
                    newShipCount: updatedPlanet?.ships,
                    newPlayerResources: newPlayerResources,
                    message: `Built ${shipCount} ships at ${planet.name} for ${totalCost} resources`,
                });
            } catch (error) {
                // Retry on version conflict
                if (error instanceof VersionConflictError && attempt < maxRetries - 1) {
                    logger.debug(`Version conflict on attempt ${attempt + 1}, retrying...`);
                    lastError = error;
                    // Small delay before retry
                    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
                    continue;
                }
                // If not a version conflict or max retries reached, throw
                throw error;
            }
        }
        
        // If we exhausted retries, return the last error
        if (lastError instanceof VersionConflictError) {
            logger.warn(`Failed to build ships after ${maxRetries} attempts due to version conflicts`);
            return json({ 
                error: 'Game state was modified by another request. Please try again.' 
            }, { status: 409 });
        }
        
        throw lastError || new Error('Failed to build ships');

    } catch (error) {
        return handleApiError(error, 'building ships', { platform });
    }
};

