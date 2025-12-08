/**
 * GameLoop - Processes game events and manages game state updates
 * 
 * Handles:
 * - Armada arrivals (battles are resolved immediately on arrival)
 * - Resource ticks
 * - Game end conditions
 */

import type { GameEvent, ArmadaArrivalPayload } from '$lib/game/entities/gameTypes';
import { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { BattleManager } from '$lib/game/mechanics/BattleManager';
import { GALACTIC_CONSTANTS, GAME_STATUS } from '$lib/game/constants/gameConstants';
import { logger } from '$lib/game/utils/logger';
import { processAITurns } from './ai/RealTimeAI';

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

        while (true) {
            const event = this.gameState.getNextEvent();
            
            if (!event || event.scheduledTime > currentTime) {
                break;
            }

            // Remove event from queue before processing
            this.gameState.popNextEvent();

            this.processEvent(event, currentTime);
            eventsProcessed = true;

            // Check if game is complete after each event
            if (this.gameState.isGameComplete()) {
                break;
            }
        }

        // Update last update time
        this.gameState.state.lastUpdateTime = currentTime;

        return eventsProcessed;
    }

    /**
     * Process a single event
     */
    private processEvent(event: GameEvent, currentTime: number): void {
        logger.debug(`Processing event: ${event.type} at ${event.scheduledTime}`);

        switch (event.type) {
            case 'armada_arrival':
                this.processArmadaArrival(event.payload as ArmadaArrivalPayload);
                break;

            case 'battle_round':
                // Battle rounds are no longer scheduled - battles resolve immediately on armada arrival
                logger.debug('Ignoring deprecated battle_round event');
                break;

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
     * Process armada arrival event
     * Note: Battles are resolved immediately when armada arrives - no delayed rounds
     */
    private processArmadaArrival(payload: ArmadaArrivalPayload): void {
        this.battleManager.handleArmadaArrival(payload.armadaId);
    }

    /**
     * Process resource tick - accumulate resources for all owned planets
     */
    private processResourceTick(currentTime: number): void {
        logger.debug('Processing resource tick');

        // Use configurable production rate from game settings
        const productionRate = this.gameState.state.productionRate ?? GALACTIC_CONSTANTS.DEFAULT_PRODUCTION_RATE;

        for (const planet of this.gameState.planets) {
            if (planet.ownerId !== null) {
                // Resources per minute = planet volume * production rate
                const resourcesGenerated = planet.volume * productionRate;
                this.gameState.addPlanetResources(planet.id, resourcesGenerated);
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

