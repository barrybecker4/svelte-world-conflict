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
import { processAITurns } from '$lib/server/ai';
import { hasArmadaArrived } from '$lib/game/entities/Armada';

export class GameLoop {
    private battleManager: BattleManager;

    constructor(private gameState: GalacticGameState) {
        this.battleManager = new BattleManager(gameState);
    }

    /**
     * Process all pending events up to the current time
     * @returns true if any events were processed
     */
    processEvents(currentTime: number = Date.now()): boolean {
        let eventsProcessed = false;
        const pendingEvents: string[] = [];

        // Process armada arrivals directly from armadas first
        // Armadas are the source of truth - they contain their arrival time
        // This ensures armadas are always processed even if events are missing
        const armadasProcessed = this.processArrivedArmadas(currentTime);
        if (armadasProcessed) {
            eventsProcessed = true;
        }

        // Then process other scheduled events
        while (true) {
            const event = this.gameState.getNextEvent();

            if (!event || event.scheduledTime > currentTime) {
                if (event) {
                    pendingEvents.push(`${event.type}@${new Date(event.scheduledTime).toISOString()}`);
                }
                break;
            }

            // Remove event from queue before processing
            this.gameState.popNextEvent();

            logger.debug(`[GameLoop] Processing ${event.type} event scheduled for ${new Date(event.scheduledTime).toISOString()} (current: ${new Date(currentTime).toISOString()})`);
            this.processEvent(event, currentTime);
            eventsProcessed = true;

            // Check if game is complete after each event
            if (this.gameState.isGameComplete()) {
                break;
            }
        }

        if (pendingEvents.length > 0) {
            logger.debug(`[GameLoop] ${pendingEvents.length} events still pending: ${pendingEvents.join(', ')}`);
        }

        // Update last update time
        this.gameState.state.lastUpdateTime = currentTime;

        return eventsProcessed;
    }

    /**
     * Process all armadas that have arrived
     * This is the source of truth - armadas contain their arrival time
     * @returns true if any armadas were processed
     */
    private processArrivedArmadas(currentTime: number): boolean {
        const armadas = this.gameState.armadas;
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
            this.battleManager.handleArmadaArrival(armadaId);
        }

        return arrivedArmadas.length > 0;
    }

    /**
     * Process a single event
     */
    private processEvent(event: GameEvent, currentTime: number): void {
        logger.debug(`Processing event: ${event.type} at ${event.scheduledTime}`);

        switch (event.type) {
            case 'resource_tick':
                this.processResourceTick(currentTime);
                break;

            case 'game_end':
                this.processGameEnd();
                break;

            default:
                logger.warn(`Unknown event type: ${event.type}`);
        }
    }

    /**
     * Process resource tick - accumulate resources into each player's global pool
     * based on the total volume of all their owned planets
     */
    private processResourceTick(currentTime: number): void {
        logger.debug('Processing resource tick');

        // Use configurable production rate from game settings
        const productionRate = this.gameState.state.productionRate ?? GALACTIC_CONSTANTS.DEFAULT_PRODUCTION_RATE;

        // Calculate resources generated for each player based on their owned planets
        for (const player of this.gameState.players) {
            if (this.gameState.isPlayerEliminated(player.slotIndex)) continue;

            // Sum up volume of all planets owned by this player
            const ownedPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
            const totalVolume = ownedPlanets.reduce((sum, planet) => sum + planet.volume, 0);

            if (totalVolume > 0) {
                // Resources per minute divided by updates per minute
                const resourcesGenerated = (totalVolume * productionRate) / GALACTIC_CONSTANTS.RESOURCE_UPDATES_PER_MIN;
                this.gameState.addPlayerResources(player.slotIndex, resourcesGenerated);
            }
        }

        // Schedule next resource tick
        this.gameState.scheduleResourceTick(currentTime + GALACTIC_CONSTANTS.RESOURCE_TICK_INTERVAL_MS);
    }

    /**
     * Process game end event
     */
    private processGameEnd(): void {
        if (this.gameState.isGameComplete()) {
            return;
        }

        logger.debug('Processing game end');

        // Determine winner
        const winner = this.gameState.determineWinner();
        this.gameState.endResult = winner;
        this.gameState.state.status = GAME_STATUS.COMPLETED;

        if (winner === 'DRAWN_GAME') {
            logger.debug('Game ended in a draw');
        } else if (winner) {
            logger.debug(`Game ended: Winner is ${winner.name}`);
        }
    }

    /**
     * Get the BattleManager for direct access
     */
    getBattleManager(): BattleManager {
        return this.battleManager;
    }
}

/**
 * Process a game state and return the updated state
 * This is the main entry point for game updates
 */
export function processGameState(gameState: GalacticGameState, currentTime: number = Date.now()): GalacticGameState {
    const gameLoop = new GameLoop(gameState);
    gameLoop.processEvents(currentTime);

    // Process AI decisions for AI players
    if (!gameState.isGameComplete()) {
        processAITurns(gameState);
    }

    return gameState;
}
