/**
 * Generic event processor for Galactic Conflict games
 * Processes game events (armada arrivals, battles, resource ticks) and broadcasts updates
 */

import { GameStorage } from '$lib/server/storage';
import type { GameRecord } from '$lib/server/storage';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { processGameState } from './GameLoop';
import { WebSocketNotifications } from './websocket/WebSocketNotifier';
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
 * Calculate number of replays added
 */
function calculateReplaysAdded(stateBefore: GameStateSnapshot, stateAfter: GameStateSnapshot): number {
    return stateAfter.replays - stateBefore.replays;
}

/**
 * Calculate number of armadas that arrived
 */
function calculateArmadasArrived(stateBefore: GameStateSnapshot, stateAfter: GameStateSnapshot): number {
    return stateBefore.armadas - stateAfter.armadas;
}

/**
 * Format the processing summary log message
 */
function formatProcessingSummary(
    gameId: string,
    replaysAdded: number,
    armadasArrived: number,
    stateBefore: GameStateSnapshot,
    stateAfter: GameStateSnapshot
): string {
    const parts = [
        `[EventProcessor] Processed events for game ${gameId}:`,
        `${replaysAdded} new replays,`,
        `${armadasArrived} armadas arrived,`,
        `status: ${stateBefore.status} -> ${stateAfter.status},`,
        `endResult: ${formatEndResult(stateBefore.endResult)} -> ${formatEndResult(stateAfter.endResult)},`,
        `lastUpdate: ${stateBefore.lastUpdateTime} -> ${stateAfter.lastUpdateTime}`
    ];
    return parts.join(' ');
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
    await WebSocketNotifications.gameUpdate(gameId, gameRecord.gameState);

    // Clear events after broadcasting (similar to battle replays)
    gameState.clearBattleReplays();
    gameState.clearReinforcementEvents();
    gameState.clearConquestEvents();
    gameState.clearPlayerEliminationEvents();

    // Save state once after clearing events (single KV write)
    gameRecord.gameState = gameState.toJSON();
    await gameStorage.saveGame(gameRecord);

    const replaysAdded = calculateReplaysAdded(stateBefore, stateAfter);
    const armadasArrived = calculateArmadasArrived(stateBefore, stateAfter);
    const summary = formatProcessingSummary(gameId, replaysAdded, armadasArrived, stateBefore, stateAfter);
    logger.info(summary);
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

