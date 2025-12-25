/**
 * API endpoint to send an armada from one planet to another
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, VersionConflictError } from '$lib/server/storage/GameStorage';
import { createArmada } from '$lib/game/entities/Armada';
import { loadActiveGame, saveAndNotify, withRetry } from '$lib/server/api-utils';
import { logger } from 'multiplayer-framework/shared';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json() as { playerId?: number; sourcePlanetId?: number; destinationPlanetId?: number; shipCount?: number };
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
        
        const result = await withRetry(async () => {
            const { gameRecord, gameState, expectedLastUpdateAt } = await loadActiveGame(gameStorage, gameId);

            // Validate the move (these are NOT retryable - they throw regular Errors)
            const sourcePlanet = gameState.getPlanet(sourcePlanetId);
            const destinationPlanet = gameState.getPlanet(destinationPlanetId);

            if (!sourcePlanet) {
                throw new Error('Source planet not found');
            }
            if (!destinationPlanet) {
                throw new Error('Destination planet not found');
            }
            if (sourcePlanet.ownerId !== playerId) {
                throw new Error('You do not own the source planet');
            }
            if (sourcePlanet.ships < shipCount) {
                throw new Error('Not enough ships on source planet');
            }
            if (sourcePlanetId === destinationPlanetId) {
                throw new Error('Source and destination must be different');
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

            // Save updated state and notify
            await saveAndNotify(gameId, gameRecord, gameState, gameStorage, expectedLastUpdateAt);

            logger.debug(`Armada sent: ${shipCount} ships from planet ${sourcePlanetId} to ${destinationPlanetId}`);

            return {
                armada,
                sourcePlanetName: sourcePlanet.name,
                destinationPlanetName: destinationPlanet.name,
            };
        }, { operationName: 'send-armada' });

        return json({
            success: true,
            message: `Sent ${shipCount} ships from ${result.sourcePlanetName} to ${result.destinationPlanetName}`,
            armada: result.armada,
        });

    } catch (error) {
        // Version conflict - server was busy, client should retry
        if (error instanceof VersionConflictError) {
            return json({ error: 'Server busy - please try again' }, { status: 409 });
        }
        // Validation or other known errors - return as 400
        if (error instanceof Error) {
            logger.warn(`Send armada failed: ${error.message}`);
            return json({ error: error.message }, { status: 400 });
        }
        // Unknown error
        logger.error('Send armada unknown error:', error);
        return json({ error: 'An unexpected error occurred' }, { status: 500 });
    }
};

