/**
 * Generic event processor for Galactic Conflict games
 * Processes game events (armada arrivals, battles, resource ticks) and broadcasts updates
 */

import { GameStorage } from './storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from './GameLoop';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';

/**
 * Process events for a single game and broadcast updates if changes occurred
 * @returns true if events were processed and updates were broadcast
 */
export async function processGameEvents(
    gameId: string,
    gameStorage: GameStorage,
    platform: App.Platform
): Promise<boolean> {
    try {
        const gameRecord = await gameStorage.loadGame(gameId);

        if (!gameRecord) {
            logger.warn(`[EventProcessor] Game ${gameId} not found`);
            return false;
        }

        if (gameRecord.status !== 'ACTIVE' || !gameRecord.gameState) {
            // Game is not active, no events to process
            return false;
        }

        const gameState = GalacticGameState.fromJSON(gameRecord.gameState);
        
        // Track state before processing
        const replaysBefore = gameState.recentBattleReplays.length;
        const reinforcementsBefore = gameState.recentReinforcementEvents.length;
        const conquestsBefore = gameState.recentConquestEvents.length;
        const eliminationsBefore = gameState.recentPlayerEliminationEvents.length;
        const armadasBefore = gameState.armadas.length;
        const statusBefore = gameState.state.status;
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
        const lastUpdateAfter = gameState.state.lastUpdateTime;
        
        // Consider it changed if:
        // - Battle replays were added
        // - Reinforcement, conquest, or elimination events were added
        // - Armadas changed (arrived or removed)
        // - Status changed (game ended)
        // - lastUpdateTime changed (events were processed, even if just resource ticks)
        const hasChanges = replaysAfter > replaysBefore || 
                          reinforcementsAfter > reinforcementsBefore ||
                          conquestsAfter > conquestsBefore ||
                          eliminationsAfter > eliminationsBefore ||
                          armadasAfter !== armadasBefore || 
                          statusAfter !== statusBefore ||
                          lastUpdateAfter !== lastUpdateBefore;

        if (hasChanges) {
            // Broadcast updates to all clients via websocket (before clearing events)
            // Include events in the broadcast so clients can process them
            gameRecord.gameState = gameState.toJSON();
            gameRecord.status = statusAfter;
            await notifyGameUpdate(gameId, gameRecord.gameState);
            
            // Clear events after broadcasting (similar to battle replays)
            gameState.clearBattleReplays();
            gameState.clearReinforcementEvents();
            gameState.clearConquestEvents();
            gameState.clearPlayerEliminationEvents();
            
            // Save state once after clearing events (single KV write)
            gameRecord.gameState = gameState.toJSON();
            await gameStorage.saveGame(gameRecord);
            
            const replaysAdded = replaysAfter - replaysBefore;
            const armadasArrived = armadasBefore - armadasAfter;
            logger.info(`[EventProcessor] Processed events for game ${gameId}: ${replaysAdded} new replays, ${armadasArrived} armadas arrived, status: ${statusBefore} -> ${statusAfter}, lastUpdate: ${lastUpdateBefore} -> ${lastUpdateAfter}`);
            return true;
        } else {
            logger.debug(`[EventProcessor] No changes detected for game ${gameId} (replays: ${replaysBefore}, armadas: ${armadasBefore}, status: ${statusBefore})`);
        }

        return false;
    } catch (error) {
        logger.error(`[EventProcessor] Error processing events for game ${gameId}:`, error);
        return false;
    }
}

/**
 * Broadcast game state update to all connected clients via websocket
 */
async function notifyGameUpdate(gameId: string, gameState: any): Promise<void> {
    try {
        // In server context, check import.meta.env.DEV (Vite/SvelteKit) or NODE_ENV
        // isLocalDevelopment() doesn't work in server context without a URL
        const isLocal = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV === true;
        const workerUrl = getWorkerHttpUrl(isLocal);

        const replaysCount = gameState?.recentBattleReplays?.length ?? 0;
        const armadasCount = gameState?.armadas?.length ?? 0;
        logger.info(`[EventProcessor] Broadcasting update for game ${gameId} to ${workerUrl}/notify (${replaysCount} replays, ${armadasCount} armadas)`);

        const notificationPayload = {
            gameId,
            message: {
                type: 'gameUpdate',
                gameId,
                gameState,
            },
        };
        
        logger.info(`[EventProcessor] Sending notification payload:`, {
            gameId,
            messageType: notificationPayload.message.type,
            hasGameState: !!notificationPayload.message.gameState,
            gameStateKeys: notificationPayload.message.gameState ? Object.keys(notificationPayload.message.gameState).slice(0, 10) : [],
            replaysCount: notificationPayload.message.gameState?.recentBattleReplays?.length ?? 0,
            armadasCount: notificationPayload.message.gameState?.armadas?.length ?? 0,
        });

        const response = await fetch(`${workerUrl}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationPayload),
        });

        if (!response.ok) {
            logger.warn(`[EventProcessor] Notify response not OK: ${response.status} ${response.statusText}`);
        } else {
            logger.debug(`[EventProcessor] Successfully notified game update for ${gameId}`);
        }
    } catch (error) {
        logger.error(`[EventProcessor] Failed to notify game update for ${gameId}:`, error);
    }
}

