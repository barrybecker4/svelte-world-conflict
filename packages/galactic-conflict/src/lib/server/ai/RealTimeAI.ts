/**
 * Real-Time AI for Galactic Conflict
 * Makes decisions for AI players in real-time gameplay
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Planet, Player, Armada } from '$lib/game/entities/gameTypes';
import { createArmada } from '$lib/game/entities/Armada';
import { getDistanceBetweenPlanets } from '$lib/game/entities/Planet';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

export interface AIDecision {
    type: 'send_armada' | 'build_ships' | 'wait';
    sourcePlanetId?: number;
    destinationPlanetId?: number;
    shipCount?: number;
}

/**
 * Process AI decisions for all AI players
 */
export class RealTimeAI {
    private lastDecisionTime: Record<number, number> = {};
    private decisionCooldown = 3000; // 3 seconds between decisions

    constructor(private gameState: GalacticGameState) {}

    /**
     * Process decisions for all AI players
     */
    processAITurns(): AIDecision[] {
        const decisions: AIDecision[] = [];
        const now = Date.now();

        for (const player of this.gameState.players) {
            if (!player.isAI) continue;
            if (this.gameState.isPlayerEliminated(player.slotIndex)) continue;

            // Check cooldown
            const lastDecision = this.lastDecisionTime[player.slotIndex] || 0;
            if (now - lastDecision < this.decisionCooldown) continue;

            const decision = this.makeDecision(player);
            if (decision.type !== 'wait') {
                decisions.push(decision);
                this.lastDecisionTime[player.slotIndex] = now;
                this.executeDecision(player, decision);
            }
        }

        return decisions;
    }

    /**
     * Make a decision for an AI player
     */
    private makeDecision(player: Player): AIDecision {
        const myPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
        
        if (myPlanets.length === 0) {
            return { type: 'wait' };
        }

        // Prioritize decisions:
        // 1. Attack weak enemy/neutral planets
        // 2. Reinforce vulnerable planets
        // 3. Build ships when resources are high

        // Try to attack
        const attackDecision = this.findAttackOpportunity(player, myPlanets);
        if (attackDecision) return attackDecision;

        // Try to build ships
        const buildDecision = this.findBuildOpportunity(player, myPlanets);
        if (buildDecision) return buildDecision;

        return { type: 'wait' };
    }

    /**
     * Find a good attack opportunity
     */
    private findAttackOpportunity(player: Player, myPlanets: Planet[]): AIDecision | null {
        const allPlanets = this.gameState.planets;
        
        // Find planets with excess ships
        const sourcePlanets = myPlanets.filter(p => p.ships >= 5);
        if (sourcePlanets.length === 0) return null;

        // Sort by most ships
        sourcePlanets.sort((a, b) => b.ships - a.ships);
        const source = sourcePlanets[0];

        // Find target - prioritize weak neutral, then weak enemy
        let bestTarget: Planet | null = null;
        let bestScore = -Infinity;

        for (const target of allPlanets) {
            if (target.ownerId === player.slotIndex) continue;

            // Calculate score based on:
            // - Lower enemy ships = higher score
            // - Neutral planets slightly preferred
            // - Closer distance = higher score
            // - Higher volume = higher score (more resources)

            const distance = getDistanceBetweenPlanets(source, target);
            const isNeutral = target.ownerId === null;
            
            let score = 0;
            score -= target.ships * 10; // Prefer fewer defenders
            score += isNeutral ? 20 : 0; // Slight preference for neutrals
            score -= distance / 10; // Prefer closer targets
            score += target.volume / 5; // Prefer larger planets

            // Only consider if we have advantage
            if (source.ships > target.ships + 2) {
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }
        }

        if (bestTarget) {
            // Send enough ships to win, but keep some defense
            const shipsToSend = Math.min(
                source.ships - 2,
                Math.max(3, Math.floor(bestTarget.ships * 1.5) + 3)
            );

            if (shipsToSend >= 3) {
                return {
                    type: 'send_armada',
                    sourcePlanetId: source.id,
                    destinationPlanetId: bestTarget.id,
                    shipCount: shipsToSend,
                };
            }
        }

        return null;
    }

    /**
     * Find opportunity to build ships
     */
    private findBuildOpportunity(player: Player, myPlanets: Planet[]): AIDecision | null {
        // Find planet with most resources
        const planetsWithResources = myPlanets.filter(
            p => p.resources >= GALACTIC_CONSTANTS.SHIP_COST * 2
        );

        if (planetsWithResources.length === 0) return null;

        // Prioritize building at planets with fewer ships (more vulnerable)
        planetsWithResources.sort((a, b) => a.ships - b.ships);
        const targetPlanet = planetsWithResources[0];

        const maxShips = Math.floor(targetPlanet.resources / GALACTIC_CONSTANTS.SHIP_COST);
        const shipsToBuild = Math.min(maxShips, 5); // Build up to 5 at a time

        if (shipsToBuild >= 1) {
            return {
                type: 'build_ships',
                sourcePlanetId: targetPlanet.id,
                shipCount: shipsToBuild,
            };
        }

        return null;
    }

    /**
     * Execute an AI decision
     */
    private executeDecision(player: Player, decision: AIDecision): void {
        switch (decision.type) {
            case 'send_armada':
                this.executeSendArmada(player, decision);
                break;
            case 'build_ships':
                this.executeBuildShips(player, decision);
                break;
        }
    }

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

    private executeBuildShips(player: Player, decision: AIDecision): void {
        if (!decision.sourcePlanetId || !decision.shipCount) return;

        const planet = this.gameState.getPlanet(decision.sourcePlanetId);
        if (!planet) return;

        const cost = decision.shipCount * GALACTIC_CONSTANTS.SHIP_COST;
        if (planet.resources < cost) return;

        // Update state
        this.gameState.spendPlanetResources(planet.id, cost);
        this.gameState.addPlanetShips(planet.id, decision.shipCount);

        logger.debug(`AI ${player.name} built ${decision.shipCount} ships at ${planet.name}`);
    }
}

/**
 * Process AI turns for a game state
 */
export function processAITurns(gameState: GalacticGameState): AIDecision[] {
    const ai = new RealTimeAI(gameState);
    return ai.processAITurns();
}

