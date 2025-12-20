/**
 * API endpoint to get game state
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/GameLoop';
import { handleApiError } from '$lib/server/api-utils';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';

export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        const { gameId } = params;
        const gameStorage = GameStorage.create(platform!);
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // For PENDING games, return the pending configuration
        if (gameRecord.status === 'PENDING') {
            return json({
                gameId: gameRecord.gameId,
                status: gameRecord.status,
                players: gameRecord.players.map(p => ({ slotIndex: p.slotIndex, name: p.name })),
                pendingConfiguration: gameRecord.pendingConfiguration,
                createdAt: gameRecord.createdAt,
            });
        }

        // For ACTIVE games, process events and return current state
        if (gameRecord.status === 'ACTIVE' && gameRecord.gameState) {
            const gameState = GalacticGameState.fromJSON(gameRecord.gameState);
            
            // Track state before processing to detect changes
            const replaysBefore = gameState.recentBattleReplays.length;
            const reinforcementsBefore = gameState.recentReinforcementEvents.length;
            const conquestsBefore = gameState.recentConquestEvents.length;
            const eliminationsBefore = gameState.recentPlayerEliminationEvents.length;
            const armadasBefore = gameState.armadas.length;
            const statusBefore = gameState.state.status;
            const endResultBefore = gameState.state.endResult;
            const lastUpdateBefore = gameState.state.lastUpdateTime;
            
            // Process any pending events (this may create battle replays, remove arrived armadas, etc.)
            processGameState(gameState);

            // Check if anything changed
            const replaysAfter = gameState.recentBattleReplays.length;
            const reinforcementsAfter = gameState.recentReinforcementEvents.length;
            const conquestsAfter = gameState.recentConquestEvents.length;
            const eliminationsAfter = gameState.recentPlayerEliminationEvents.length;
            const armadasAfter = gameState.armadas.length;
            const statusAfter = gameState.state.status;
            const endResultAfter = gameState.state.endResult;
            const lastUpdateAfter = gameState.state.lastUpdateTime;
            
            // Helper to compare endResult (handles object equality)
            const endResultChanged = (() => {
                if (endResultBefore === endResultAfter) return false;
                if (endResultBefore === null || endResultAfter === null) return true;
                if (endResultBefore === 'DRAWN_GAME' || endResultAfter === 'DRAWN_GAME') {
                    return endResultBefore !== endResultAfter;
                }
                // Both are Player objects - compare slotIndex
                return (endResultBefore as any).slotIndex !== (endResultAfter as any).slotIndex;
            })();
            
            const hasChanges = replaysAfter > replaysBefore || 
                              reinforcementsAfter > reinforcementsBefore ||
                              conquestsAfter > conquestsBefore ||
                              eliminationsAfter > eliminationsBefore ||
                              armadasAfter !== armadasBefore || 
                              statusAfter !== statusBefore ||
                              endResultChanged ||
                              lastUpdateAfter !== lastUpdateBefore;

            // Only write to KV if state actually changed
            if (hasChanges) {
                // Save updated state
                gameRecord.gameState = gameState.toJSON();
                gameRecord.status = statusAfter;
                await gameStorage.saveGame(gameRecord);
                
                // Broadcast if:
                // - New battle replays were created
                // - Game status changed to COMPLETED
                // - endResult changed (game ended)
                const replaysAdded = replaysAfter - replaysBefore;
                const shouldBroadcast = replaysAdded > 0 || 
                                       statusAfter === 'COMPLETED' || 
                                       endResultChanged;
                
                if (shouldBroadcast) {
                    logger.debug(`[GET /game] Broadcasting update: ${replaysAdded} new replays, status: ${statusBefore} -> ${statusAfter}, endResult changed: ${endResultChanged}`);
                    await notifyGameUpdate(gameId, gameRecord.gameState);
                }
            }

            // Return current state (whether we saved or not)
            return json({
                gameId: gameRecord.gameId,
                status: hasChanges ? statusAfter : gameRecord.status,
                gameState: hasChanges ? gameState.toJSON() : gameRecord.gameState,
            });
        }

        // COMPLETED games
        return json({
            gameId: gameRecord.gameId,
            status: gameRecord.status,
            gameState: gameRecord.gameState,
        });

    } catch (error) {
        return handleApiError(error, 'getting game', { platform });
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

