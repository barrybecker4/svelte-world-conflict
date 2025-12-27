/**
 * API endpoint to get game state
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, VersionConflictError, type GameRecord } from '$lib/server/storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from '$lib/server/processing/GameLoop';
import { handleApiError } from '$lib/server/api-utils';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { logger } from 'multiplayer-framework/shared';

interface GameStateSnapshot {
    replays: number;
    reinforcements: number;
    conquests: number;
    eliminations: number;
    armadas: number;
    status: string;
    endResult: any;
    lastUpdateTime: number;
}

function captureSnapshot(gameState: GalacticGameState): GameStateSnapshot {
    return {
        replays: gameState.recentBattleReplays.length,
        reinforcements: gameState.recentReinforcementEvents.length,
        conquests: gameState.recentConquestEvents.length,
        eliminations: gameState.recentPlayerEliminationEvents.length,
        armadas: gameState.armadas.length,
        status: gameState.state.status,
        endResult: gameState.state.endResult,
        lastUpdateTime: gameState.state.lastUpdateTime,
    };
}

function hasEndResultChanged(before: any, after: any): boolean {
    if (before === after) return false;
    if (before === null || after === null) return true;
    if (before === 'DRAWN_GAME' || after === 'DRAWN_GAME') {
        return before !== after;
    }
    // Both are Player objects - compare slotIndex
    return (before as any).slotIndex !== (after as any).slotIndex;
}

function hasStateChanged(before: GameStateSnapshot, after: GameStateSnapshot): boolean {
    return after.replays > before.replays ||
           after.reinforcements > before.reinforcements ||
           after.conquests > before.conquests ||
           after.eliminations > before.eliminations ||
           after.armadas !== before.armadas ||
           after.status !== before.status ||
           hasEndResultChanged(before.endResult, after.endResult) ||
           after.lastUpdateTime !== before.lastUpdateTime;
}

async function saveAndBroadcastIfNeeded(
    gameId: string,
    gameRecord: GameRecord,
    gameState: GalacticGameState,
    before: GameStateSnapshot,
    after: GameStateSnapshot,
    gameStorage: GameStorage,
    expectedLastUpdateAt: number
): Promise<void> {
    try {
        gameRecord.gameState = gameState.toJSON();
        gameRecord.status = after.status as 'PENDING' | 'ACTIVE' | 'COMPLETED';
        await gameStorage.saveGame(gameRecord, expectedLastUpdateAt);
        
        // Broadcast if: new replays, status changed to COMPLETED, or endResult changed
        const replaysAdded = after.replays - before.replays;
        const shouldBroadcast = replaysAdded > 0 || 
                               after.status === 'COMPLETED' || 
                               hasEndResultChanged(before.endResult, after.endResult);
        
        if (shouldBroadcast) {
            logger.debug(`[GET /game] Broadcasting update: ${replaysAdded} new replays, status: ${before.status} -> ${after.status}`);
            await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);
        }
    } catch (error) {
        // If version conflict, log and continue - acceptable for GET endpoints
        if (error instanceof VersionConflictError) {
            logger.debug(`[GET /game] Version conflict detected, skipping save. Game was modified by another request.`);
        } else {
            throw error;
        }
    }
}

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
            const expectedLastUpdateAt = gameRecord.lastUpdateAt;
            const gameState = GalacticGameState.fromJSON(gameRecord.gameState);
            
            const before = captureSnapshot(gameState);
            processGameState(gameState);
            const after = captureSnapshot(gameState);
            
            const hasChanges = hasStateChanged(before, after);
            
            if (hasChanges) {
                await saveAndBroadcastIfNeeded(
                    gameId,
                    gameRecord,
                    gameState,
                    before,
                    after,
                    gameStorage,
                    expectedLastUpdateAt
                );
            }

            return json({
                gameId: gameRecord.gameId,
                status: hasChanges ? after.status : gameRecord.status,
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
