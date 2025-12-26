/**
 * Attack Strategy for AI
 * Handles all attack-related decision logic
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Planet, Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { getDistanceBetweenPlanets } from '$lib/game/entities/Planet';
import { getAIDifficultyConfig, type AIDifficultyConfig } from './aiDifficultyConfig';
import type { AIDecision } from './RealTimeAI';

/**
 * Attack strategy for finding and evaluating attack opportunities
 */
export class AttackStrategy {
    constructor(private gameState: GalacticGameState) {}

    /**
     * Find a good attack opportunity
     */
    findAttackOpportunity(player: Player, myPlanets: Planet[], difficulty: AiDifficulty): AIDecision | null {
        const config = getAIDifficultyConfig(difficulty);
        
        // Find source planets with sufficient ships
        const sourcePlanets = this.findSourcePlanetsForAttack(myPlanets, difficulty, config);
        if (sourcePlanets.length === 0) return null;

        // Sort by most ships and pick the best source
        sourcePlanets.sort((a, b) => b.ships - a.ships);
        const source = sourcePlanets[0];

        // Find the best target
        const bestTarget = this.findBestTarget(source, this.gameState.planets, player, config);
        if (!bestTarget) return null;

        // Calculate ships to send
        const shipsToSend = this.calculateShipsToSend(source, bestTarget, config);
        if (shipsToSend < config.attack.minShipsToSend) return null;

        return {
            type: 'send_armada',
            sourcePlanetId: source.id,
            destinationPlanetId: bestTarget.id,
            shipCount: shipsToSend,
        };
    }

    /**
     * Find planets that can serve as sources for attacks
     */
    private findSourcePlanetsForAttack(myPlanets: Planet[], difficulty: AiDifficulty, config: AIDifficultyConfig): Planet[] {
        const minSourceShips = config.attack.minSourceShips;
        
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
        }
        
        return sourcePlanets;
    }

    /**
     * Find the best target planet for an attack from the given source
     */
    private findBestTarget(source: Planet, allPlanets: Planet[], player: Player, config: AIDifficultyConfig): Planet | null {
        const minAdvantage = config.attack.minAdvantage;
        let bestTarget: Planet | null = null;
        let bestScore = -Infinity;

        for (const target of allPlanets) {
            if (target.ownerId === player.slotIndex) continue;

            // Only consider if we have advantage (threshold varies by difficulty)
            if (source.ships <= target.ships + minAdvantage) continue;

            const score = this.scoreTargetPlanet(target, source, player);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        return bestTarget;
    }

    /**
     * Score a target planet based on various factors
     * Higher score = better target
     */
    private scoreTargetPlanet(target: Planet, source: Planet, player: Player): number {
        const distance = getDistanceBetweenPlanets(source, target);
        const isNeutral = target.ownerId === null;
        
        let score = 0;
        score -= target.ships * 10; // Prefer fewer defenders
        score += isNeutral ? 20 : 0; // Slight preference for neutrals
        score -= distance / 10; // Prefer closer targets
        score += target.volume / 5; // Prefer larger planets
        
        return score;
    }

    /**
     * Calculate how many ships to send in an attack
     */
    private calculateShipsToSend(source: Planet, target: Planet, config: AIDifficultyConfig): number {
        const minShipsToSend = config.attack.minShipsToSend;
        const minAdvantage = config.attack.minAdvantage;
        const defenseBuffer = config.attack.defenseBuffer;
        
        // Send enough ships to win, but keep some defense
        return Math.min(
            source.ships - defenseBuffer,
            Math.max(minShipsToSend, Math.floor(target.ships * 1.5) + minAdvantage)
        );
    }
}

