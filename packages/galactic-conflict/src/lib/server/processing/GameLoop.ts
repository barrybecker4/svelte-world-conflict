/**
 * GameLoop - Processes game events and manages game state updates
 *
 * Handles:
 * - Armada arrivals (battles are resolved immediately on arrival)
 * - Resource ticks
 * - Game end conditions
 */

import type { GameEvent } from '$lib/game/entities/gameTypes';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { BattleManager } from '$lib/game/mechanics/BattleManager';
import { GALACTIC_CONSTANTS, GAME_STATUS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';
import { processAITurns } from '../ai';
import { hasArmadaArrived } from '$lib/game/entities/Armada';

/**
 * Process all armadas that have arrived
 * This is the source of truth - armadas contain their arrival time
 * @returns true if any armadas were processed
 */
function processArrivedArmadas(gameState: GalacticGameState, battleManager: BattleManager, currentTime: number): boolean {
    const armadas = gameState.armadas;
    const arrivedArmadas: string[] = [];

    // Find all armadas that have arrived
    for (const armada of armadas) {
        if (hasArmadaArrived(armada, currentTime)) {
            arrivedArmadas.push(armada.id);
        }
    }

    // Process each arrived armada
    for (const armadaId of arrivedArmadas) {
        logger.info(`[GameLoop] Processing arrived armada ${armadaId} (checked directly from armada state)`);
        battleManager.handleArmadaArrival(armadaId);
    }

    return arrivedArmadas.length > 0;
}

/**
 * Process resource tick - accumulate resources into each player's global pool
 * based on the total volume of all their owned planets
 */
function processResourceTick(gameState: GalacticGameState, currentTime: number): void {
    logger.debug('Processing resource tick');

    // Use configurable production rate from game settings
    const productionRate = gameState.state.productionRate ?? GALACTIC_CONSTANTS.DEFAULT_PRODUCTION_RATE;

    // Calculate resources generated for each player based on their owned planets
    for (const player of gameState.players) {
        if (gameState.isPlayerEliminated(player.slotIndex)) continue;

        // Sum up volume of all planets owned by this player
        const ownedPlanets = gameState.getPlanetsOwnedBy(player.slotIndex);
        const totalVolume = ownedPlanets.reduce((sum, planet) => sum + planet.volume, 0);

        if (totalVolume > 0) {
            // Resources per minute divided by updates per minute
            const resourcesGenerated = (totalVolume * productionRate) / GALACTIC_CONSTANTS.RESOURCE_UPDATES_PER_MIN;
            gameState.addPlayerResources(player.slotIndex, resourcesGenerated);
        }
    }

    // Schedule next resource tick
    gameState.scheduleResourceTick(currentTime + GALACTIC_CONSTANTS.RESOURCE_TICK_INTERVAL_MS);
}

/**
 * Process game end event
 */
function processGameEnd(gameState: GalacticGameState): void {
    if (gameState.isGameComplete()) {
        return;
    }

    logger.debug('Processing game end');

    // Determine winner
    const winner = gameState.determineWinner();
    gameState.endResult = winner;
    gameState.state.status = GAME_STATUS.COMPLETED;

    if (winner === 'DRAWN_GAME') {
        logger.debug('Game ended in a draw');
    } else if (winner) {
        logger.debug(`Game ended: Winner is ${winner.name}`);
    }
}

/**
 * Process a single event
 */
function processEvent(gameState: GalacticGameState, event: GameEvent, currentTime: number): void {
    logger.debug(`Processing event: ${event.type} at ${event.scheduledTime}`);

    switch (event.type) {
        case 'resource_tick':
            processResourceTick(gameState, currentTime);
            break;

        case 'game_end':
            processGameEnd(gameState);
            break;

        default:
            logger.warn(`Unknown event type: ${event.type}`);
    }
}

/**
 * Process all pending events up to the current time
 * @returns true if any events were processed
 */
function processEvents(gameState: GalacticGameState, battleManager: BattleManager, currentTime: number): boolean {
    let eventsProcessed = false;
    const pendingEvents: string[] = [];

    // Process armada arrivals directly from armadas first
    // Armadas are the source of truth - they contain their arrival time
    // This ensures armadas are always processed even if events are missing
    const armadasProcessed = processArrivedArmadas(gameState, battleManager, currentTime);
    if (armadasProcessed) {
        eventsProcessed = true;
    }

    // Then process other scheduled events
    while (true) {
        const event = gameState.getNextEvent();

        if (!event || event.scheduledTime > currentTime) {
            if (event) {
                pendingEvents.push(`${event.type}@${new Date(event.scheduledTime).toISOString()}`);
            }
            break;
        }

        // Remove event from queue before processing
        gameState.popNextEvent();

        logger.debug(`[GameLoop] Processing ${event.type} event scheduled for ${new Date(event.scheduledTime).toISOString()} (current: ${new Date(currentTime).toISOString()})`);
        processEvent(gameState, event, currentTime);
        eventsProcessed = true;

        // Check if game is complete after each event
        if (gameState.isGameComplete()) {
            break;
        }
    }

    if (pendingEvents.length > 0) {
        logger.debug(`[GameLoop] ${pendingEvents.length} events still pending: ${pendingEvents.join(', ')}`);
    }

    // Update last update time
    gameState.state.lastUpdateTime = currentTime;

    return eventsProcessed;
}

/**
 * Process a game state and return the updated state
 * This is the main entry point for game updates
 */
export function processGameState(gameState: GalacticGameState, currentTime: number = Date.now()): GalacticGameState {
    const battleManager = new BattleManager(gameState);
    processEvents(gameState, battleManager, currentTime);

    // Process AI decisions for AI players
    if (!gameState.isGameComplete()) {
        processAITurns(gameState);
    }

    return gameState;
}

