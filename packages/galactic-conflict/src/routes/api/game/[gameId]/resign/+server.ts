/**
 * API endpoint for a player to resign from the game
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { handleApiError } from '$lib/server/api-utils';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { logger } from 'multiplayer-framework/shared';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json() as { playerId?: number };
        const { playerId } = body;

        // Validate required fields
        if (playerId === undefined) {
            return json({ error: 'Player ID is required' }, { status: 400 });
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

        // Validate the player exists
        const player = gameState.getPlayer(playerId);
        if (!player) {
            return json({ error: 'Player not found' }, { status: 400 });
        }

        // Check if already eliminated
        if (gameState.isPlayerEliminated(playerId)) {
            return json({ error: 'Player is already eliminated' }, { status: 400 });
        }

        // Resign the player:
        // 1. Mark as eliminated
        gameState.eliminatePlayer(playerId);

        // 2. Convert their planets to neutral (null owner), keeping ships as neutral garrison
        const playerPlanets = gameState.getPlanetsOwnedBy(playerId);
        for (const planet of playerPlanets) {
            gameState.setPlanetOwner(planet.id, null);
        }

        // 3. Remove their in-transit armadas
        const playerArmadas = gameState.getArmadasForPlayer(playerId);
        for (const armada of playerArmadas) {
            gameState.removeArmada(armada.id);
        }

        // 4. Check if game should end (only one player remaining)
        const activePlayers = gameState.players.filter(
            p => !gameState.isPlayerEliminated(p.slotIndex)
        );

        if (activePlayers.length <= 1 && !gameState.isGameComplete()) {
            // Game ends - single player remaining or no players
            gameState.state.status = 'COMPLETED';
            gameState.endResult = activePlayers.length === 1
                ? activePlayers[0]
                : 'DRAWN_GAME';

            logger.debug(`Game ended after resignation: ${gameState.endResult === 'DRAWN_GAME' ? 'Draw' : `Winner: ${activePlayers[0].name}`}`);
        }

        // Save updated state
        gameRecord.gameState = gameState.toJSON();
        await gameStorage.saveGame(gameRecord);

        // Notify other players
        await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);

        logger.debug(`Player ${player.name} (slot ${playerId}) resigned from game ${gameId}`);

        return json({
            success: true,
            message: `${player.name} has resigned from the game`,
            gameEnded: gameState.isGameComplete(),
        });

    } catch (error) {
        return handleApiError(error, 'resigning from game', { platform });
    }
};

