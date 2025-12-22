/**
 * Generic event processor for Galactic Conflict games
 * Processes game events (armada arrivals, battles, resource ticks) and broadcasts updates
 */

import { GameStorage } from './storage/GameStorage';
import type { GameRecord } from './storage/GameStorage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { GalacticGameStateData } from '$lib/game/entities/gameTypes';
import { processGameState } from './GameLoop';
import { getWorkerHttpUrl } from '$lib/websocket-config';
import { isLocalDevelopment } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';
import { captureGameStateBefore, captureGameStateAfter, detectGameStateChanges, type GameStateSnapshot } from './utils/detectGameStateChanges';
import { formatEndResult } from './utils/gameStateFormatters';

/**
 * Load and validate game record
 * @returns game record and state if valid, null otherwise
 */
async function loadAndValidateGame(
    gameId: string,
    gameStorage: GameStorage
): Promise<{ gameRecord: GameRecord; gameState: GalacticGameState } | null> {
    const gameRecord = await gameStorage.loadGame(gameId);

    if (!gameRecord) {
        logger.warn(`[EventProcessor] Game ${gameId} not found`);
        return null;
    }

    if (gameRecord.status !== 'ACTIVE' || !gameRecord.gameState) {
        // Game is not active, no events to process
        return null;
    }

    const gameState = GalacticGameState.fromJSON(gameRecord.gameState);
    return { gameRecord, gameState };
}

/**
 * Process game state and detect changes
 * @returns state snapshots and whether changes were detected
 */
function processAndDetectChanges(gameState: GalacticGameState): {
    stateBefore: GameStateSnapshot;
    stateAfter: GameStateSnapshot;
    hasChanges: boolean;
} {
    // Track state before processing
    const stateBefore = captureGameStateBefore(gameState);
    
    // Process any pending events (this may create battle replays, remove arrived armadas, etc.)
    // Even if game is already COMPLETED, we need to process any remaining events (like final battles)
    processGameState(gameState);

    // Check if anything changed
    const stateAfter = captureGameStateAfter(gameState);
    const hasChanges = detectGameStateChanges(stateBefore, stateAfter);

    return { stateBefore, stateAfter, hasChanges };
}

/**
 * Broadcast updates and save game state
 */
async function broadcastAndSaveChanges(
    gameId: string,
    gameRecord: GameRecord,
    gameState: GalacticGameState,
    stateBefore: GameStateSnapshot,
    stateAfter: GameStateSnapshot,
    gameStorage: GameStorage
): Promise<void> {
    // Broadcast updates to all clients via websocket (before clearing events)
    // Include events in the broadcast so clients can process them
    // Broadcast BEFORE saving, so clients get the update with battle replays
    gameRecord.gameState = gameState.toJSON();
    gameRecord.status = stateAfter.status as 'PENDING' | 'ACTIVE' | 'COMPLETED';
    await notifyGameUpdate(gameId, gameRecord.gameState);
    
    // Clear events after broadcasting (similar to battle replays)
    gameState.clearBattleReplays();
    gameState.clearReinforcementEvents();
    gameState.clearConquestEvents();
    gameState.clearPlayerEliminationEvents();
    
    // Save state once after clearing events (single KV write)
    gameRecord.gameState = gameState.toJSON();
    await gameStorage.saveGame(gameRecord);
    
    const replaysAdded = stateAfter.replays - stateBefore.replays;
    const armadasArrived = stateBefore.armadas - stateAfter.armadas;
    logger.info(`[EventProcessor] Processed events for game ${gameId}: ${replaysAdded} new replays, ${armadasArrived} armadas arrived, status: ${stateBefore.status} -> ${stateAfter.status}, endResult: ${formatEndResult(stateBefore.endResult)} -> ${formatEndResult(stateAfter.endResult)}, lastUpdate: ${stateBefore.lastUpdateTime} -> ${stateAfter.lastUpdateTime}`);
}

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
        const loaded = await loadAndValidateGame(gameId, gameStorage);
        if (!loaded) {
            return false;
        }

        const { gameRecord, gameState } = loaded;
        const { stateBefore, stateAfter, hasChanges } = processAndDetectChanges(gameState);

        if (hasChanges) {
            await broadcastAndSaveChanges(gameId, gameRecord, gameState, stateBefore, stateAfter, gameStorage);
            return true;
        } else {
            logger.debug(`[EventProcessor] No changes detected for game ${gameId} (replays: ${stateBefore.replays}, armadas: ${stateBefore.armadas}, status: ${stateBefore.status})`);
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
async function notifyGameUpdate(gameId: string, gameState: GalacticGameStateData): Promise<void> {
    try {
        // In server context, check import.meta.env.DEV (Vite/SvelteKit) or NODE_ENV
        // isLocalDevelopment() doesn't work in server context without a URL
        interface ImportMeta {
            env?: {
                DEV?: boolean;
            };
        }
        const isLocal = typeof import.meta !== 'undefined' && (import.meta as unknown as ImportMeta).env?.DEV === true;
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

