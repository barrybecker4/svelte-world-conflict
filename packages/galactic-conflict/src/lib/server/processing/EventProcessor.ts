/**
 * Generic event processor for Galactic Conflict games
 * Processes game events (armada arrivals, battles, resource ticks) and broadcasts updates
 */

import { GameStorage, VersionConflictError } from '../storage';
import type { GameRecord } from '../storage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from './GameLoop';
import { WebSocketNotifications } from '../websocket/WebSocketNotifier';
import { logger } from 'multiplayer-framework/shared';
import { captureGameStateBefore, captureGameStateAfter, detectGameStateChanges, type GameStateSnapshot } from '../utils/detectGameStateChanges';
import { formatEndResult } from '../utils/gameStateFormatters';

/**
 * Load and validate game record
 * @returns game record and state if valid, null otherwise
 */
async function loadAndValidateGame(
    gameId: string,
    gameStorage: GameStorage
): Promise<{ gameRecord: GameRecord; gameState: GalacticGameState; expectedLastUpdateAt: number } | null> {
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
    return { gameRecord, gameState, expectedLastUpdateAt: gameRecord.lastUpdateAt };
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
 * 
 * IMPORTANT: We save BEFORE broadcasting to prevent sending stale data.
 * If there's a version conflict, we skip the broadcast because another
 * process has already updated the state with newer data.
 */
async function broadcastAndSaveChanges(
    gameId: string,
    gameRecord: GameRecord,
    gameState: GalacticGameState,
    stateBefore: GameStateSnapshot,
    stateAfter: GameStateSnapshot,
    gameStorage: GameStorage,
    expectedLastUpdateAt: number
): Promise<void> {
    // Prepare state for broadcast (includes battle replays and events)
    const stateForBroadcast = gameState.toJSON();
    
    // Clear events after capturing state for broadcast
    gameState.clearBattleReplays();
    gameState.clearReinforcementEvents();
    gameState.clearConquestEvents();
    gameState.clearPlayerEliminationEvents();

    // Save state first with optimistic locking
    // Only broadcast if save succeeds - this prevents sending stale data
    // when another process has already updated the state
    try {
        gameRecord.gameState = gameState.toJSON();
        gameRecord.status = stateAfter.status as 'PENDING' | 'ACTIVE' | 'COMPLETED';
        await gameStorage.saveGame(gameRecord, expectedLastUpdateAt);

        // Save succeeded - now broadcast the state (which includes battle replays)
        await WebSocketNotifications.gameUpdate(gameId, stateForBroadcast);

        const replaysAdded = stateAfter.replays - stateBefore.replays;
        const armadasArrived = stateBefore.armadas - stateAfter.armadas;
        logger.info(
            `[EventProcessor] Processed events for game ${gameId}: ` +
            `${replaysAdded} new replays, ` +
            `${armadasArrived} armadas arrived, ` +
            `status: ${stateBefore.status} -> ${stateAfter.status}, ` +
            `endResult: ${formatEndResult(stateBefore.endResult)} -> ${formatEndResult(stateAfter.endResult)}, ` +
            `lastUpdate: ${stateBefore.lastUpdateTime} -> ${stateAfter.lastUpdateTime}`
        );
    } catch (error) {
        // If version conflict, DO NOT broadcast - another process already has newer data
        // The next EventProcessor run will pick up the correct state
        if (error instanceof VersionConflictError) {
            logger.debug(`[EventProcessor] Version conflict for game ${gameId}, skipping save AND broadcast. Another process has newer data.`);
        } else {
            throw error;
        }
    }
}

/**
 * Process events for a single game and broadcast updates if changes occurred
 * @returns true if events were processed and updates were broadcast
 */
export async function processGameEvents(
    gameId: string,
    gameStorage: GameStorage,
    _platform: App.Platform
): Promise<boolean> {
    try {
        const loaded = await loadAndValidateGame(gameId, gameStorage);
        if (!loaded) {
            return false;
        }

        const { gameRecord, gameState, expectedLastUpdateAt } = loaded;
        const { stateBefore, stateAfter, hasChanges } = processAndDetectChanges(gameState);

        if (hasChanges) {
            await broadcastAndSaveChanges(gameId, gameRecord, gameState, stateBefore, stateAfter, gameStorage, expectedLastUpdateAt);
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

