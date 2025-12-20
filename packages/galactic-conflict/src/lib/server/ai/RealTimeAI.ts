/**
 * Real-Time AI for Galactic Conflict
 * Makes decisions for AI players in real-time gameplay
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Planet, Player, Armada, AiDifficulty } from '$lib/game/entities/gameTypes';
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
    private playerDifficulties: Record<number, AiDifficulty> = {};

    constructor(private gameState: GalacticGameState) {
        // Store difficulty for each AI player
        for (const player of gameState.players) {
            if (player.isAI) {
                this.playerDifficulties[player.slotIndex] = player.difficulty || 'easy';
            }
        }
    }

    /**
     * Get cooldown time based on difficulty
     */
    private getCooldownForDifficulty(difficulty: AiDifficulty): number {
        switch (difficulty) {
            case 'easy': return 20000; // infrequent
            case 'medium': return 9000; // moderate
            case 'hard': return 3000; //  aggressive
            default: return 9000;
        }
    }

    /**
     * Process decisions for all AI players
     */
    processAITurns(): AIDecision[] {
        const decisions: AIDecision[] = [];
        const now = Date.now();

        for (const player of this.gameState.players) {
            if (!player.isAI) continue;
            if (this.gameState.isPlayerEliminated(player.slotIndex)) continue;

            const difficulty = this.playerDifficulties[player.slotIndex] || 'easy';
            const cooldown = this.getCooldownForDifficulty(difficulty);

            // Check cooldown
            const lastDecision = this.lastDecisionTime[player.slotIndex] || 0;
            if (now - lastDecision < cooldown) continue;

            const decision = this.makeDecision(player, difficulty);
            if (decision.type !== 'wait') {
                decisions.push(decision);
                this.lastDecisionTime[player.slotIndex] = now;
                this.executeDecision(player, decision);
            }
        }

        return decisions;
    }

    /**
     * Make a decision for an AI player/
     * Prioritize decisions:
     *    1. Attack weak enemy/neutral planets
     *    2. Reinforce vulnerable planets
     *    3. Build ships when resources are high
     */
    private makeDecision(player: Player, difficulty: AiDifficulty): AIDecision {
        const myPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
        
        if (myPlanets.length === 0) {
            return { type: 'wait' };
        }

        // Try to build ships
        const buildDecision = this.findBuildOpportunity(player, myPlanets, difficulty);
        if (buildDecision) return buildDecision;

        // Try to attack
        const attackDecision = this.findAttackOpportunity(player, myPlanets, difficulty);
        if (attackDecision) return attackDecision;

        return { type: 'wait' };
    }

    /**
     * Find a good attack opportunity
     */
    private findAttackOpportunity(player: Player, myPlanets: Planet[], difficulty: AiDifficulty): AIDecision | null {
        const allPlanets = this.gameState.planets;
        
        // Get difficulty-based thresholds
        const minSourceShips = difficulty === 'easy' ? 8 : difficulty === 'medium' ? 5 : 3;
        const minAdvantage = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;
        const minShipsToSend = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 2;

        // Find planets with excess ships (threshold varies by difficulty)
        const sourcePlanets = myPlanets.filter(p => p.ships >= minSourceShips);
        if (sourcePlanets.length === 0) {
            // If no planets meet the threshold, try with lower threshold for hard AI
            if (difficulty === 'hard') {
                const lowerThresholdPlanets = myPlanets.filter(p => p.ships >= 2);
                if (lowerThresholdPlanets.length > 0) {
                    sourcePlanets.push(...lowerThresholdPlanets);
                }
            }
            if (sourcePlanets.length === 0) return null;
        }

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

            // Only consider if we have advantage (threshold varies by difficulty)
            if (source.ships > target.ships + minAdvantage) {
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }
        }

        if (bestTarget) {
            // Send enough ships to win, but keep some defense
            // Hard AI is more aggressive and sends more ships
            const defenseBuffer = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;
            const shipsToSend = Math.min(
                source.ships - defenseBuffer,
                Math.max(minShipsToSend, Math.floor(bestTarget.ships * 1.5) + minAdvantage)
            );

            if (shipsToSend >= minShipsToSend) {
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
    private findBuildOpportunity(player: Player, myPlanets: Planet[], difficulty: AiDifficulty): AIDecision | null {
        // Check global player resources (resources are stored per player, not per planet)
        const playerResources = this.gameState.getPlayerResources(player.slotIndex);
        
        // Difficulty-based resource threshold (hard AI builds more aggressively)
        const resourceMultiplier = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 1.5 : 1;
        const minResources = GALACTIC_CONSTANTS.SHIP_COST * resourceMultiplier;
        
        // Check if player has enough resources
        if (playerResources < minResources) return null;

        // Find planets to build at - prioritize vulnerable planets (fewer ships)
        // Hard AI is more aggressive and builds at any planet, easy AI is more selective
        const minShipsOnPlanet = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 0;
        const candidatePlanets = myPlanets.filter(p => p.ships <= minShipsOnPlanet || myPlanets.length === 1);
        
        if (candidatePlanets.length === 0) {
            // If no vulnerable planets, just pick the one with fewest ships
            candidatePlanets.push(...myPlanets);
        }

        // Sort by ships (fewest first) to prioritize vulnerable planets
        candidatePlanets.sort((a, b) => a.ships - b.ships);
        const targetPlanet = candidatePlanets[0];

        // Calculate how many ships to build based on available resources
        const maxShipsFromResources = Math.floor(playerResources / GALACTIC_CONSTANTS.SHIP_COST);
        // Hard AI builds more ships at once, easy AI is more conservative
        const maxBuildAtOnce = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 10;
        const shipsToBuild = Math.min(maxShipsFromResources, maxBuildAtOnce);

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

/**
 * Process AI turns for a game state
 */
export function processAITurns(gameState: GalacticGameState): AIDecision[] {
    const ai = new RealTimeAI(gameState);
    return ai.processAITurns();
}

