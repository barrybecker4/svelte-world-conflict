/**
 * API endpoint to send an armada from one planet to another
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, VersionConflictError } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { createArmada } from '$lib/game/entities/Armada';
import { handleApiError } from '$lib/server/api-utils';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
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

                // Save updated state with optimistic locking
                gameRecord.gameState = gameState.toJSON();
                await gameStorage.saveGame(gameRecord, expectedLastUpdateAt);

                // Notify other players
                await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);

                logger.debug(`Armada sent: ${shipCount} ships from planet ${sourcePlanetId} to ${destinationPlanetId}`);

                return json({
                    success: true,
                    armada,
                    message: `Sent ${shipCount} ships from ${sourcePlanet.name} to ${destinationPlanet.name}`,
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
            logger.warn(`Failed to send armada after ${maxRetries} attempts due to version conflicts`);
            return json({ 
                error: 'Game state was modified by another request. Please try again.' 
            }, { status: 409 });
        }
        
        throw lastError || new Error('Failed to send armada');

    } catch (error) {
        return handleApiError(error, 'sending armada', { platform });
    }
};

