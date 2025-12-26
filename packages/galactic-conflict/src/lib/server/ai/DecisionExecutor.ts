/**
 * Decision Executor for AI
 * Handles execution of AI decisions (state mutations)
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Player } from '$lib/game/entities/gameTypes';
import { createArmada } from '$lib/game/entities/Armada';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';
import type { AIDecision } from './RealTimeAI';

/**
 * Executes AI decisions by mutating game state
 */
export class DecisionExecutor {
    constructor(private gameState: GalacticGameState) {}

    /**
     * Execute an AI decision
     */
    executeDecision(player: Player, decision: AIDecision): void {
        switch (decision.type) {
            case 'send_armada':
                this.executeSendArmada(player, decision);
                break;
            case 'build_ships':
                this.executeBuildShips(player, decision);
                break;
        }
    }

    /**
     * Execute sending an armada
     */
    private executeSendArmada(player: Player, decision: AIDecision): void {
        if (!decision.sourcePlanetId || !decision.destinationPlanetId || !decision.shipCount) {
            return;
        }

        const sourcePlanet = this.gameState.getPlanet(decision.sourcePlanetId);
        const destPlanet = this.gameState.getPlanet(decision.destinationPlanetId);

        if (!sourcePlanet || !destPlanet) return;
        if (sourcePlanet.ships < decision.shipCount) return;

        // Create armada
        const armada = createArmada(
            player.slotIndex,
            decision.shipCount,
            sourcePlanet,
            destPlanet,
            this.gameState.armadaSpeed
        );

        // Update state
        this.gameState.setPlanetShips(sourcePlanet.id, sourcePlanet.ships - decision.shipCount);
        this.gameState.addArmada(armada);

        logger.debug(`AI ${player.name} sent ${decision.shipCount} ships from ${sourcePlanet.name} to ${destPlanet.name}`);
    }

    /**
     * Execute building ships
     */
    private executeBuildShips(player: Player, decision: AIDecision): void {
        if (!decision.sourcePlanetId || !decision.shipCount) return;

        const planet = this.gameState.getPlanet(decision.sourcePlanetId);
        if (!planet) return;

        const cost = decision.shipCount * GALACTIC_CONSTANTS.SHIP_COST;
        const playerResources = this.gameState.getPlayerResources(player.slotIndex);
        
        // Check if player has enough global resources
        if (playerResources < cost) {
            logger.debug(`AI ${player.name} attempted to build ${decision.shipCount} ships but only has ${playerResources} resources (needs ${cost})`);
            return;
        }

        // Spend from global player resources and add ships to planet
        this.gameState.spendPlayerResources(player.slotIndex, cost);
        this.gameState.addPlanetShips(planet.id, decision.shipCount);

        logger.debug(`AI ${player.name} built ${decision.shipCount} ships at ${planet.name} for ${cost} resources (remaining: ${this.gameState.getPlayerResources(player.slotIndex)})`);
    }
}

