/**
 * Attack Strategy for AI
 * Handles all attack-related decision logic
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Planet, Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { getDistanceBetweenPlanets } from '$lib/game/entities/Planet';
import { getAIDifficultyConfig, type AIDifficultyConfig } from './aiDifficultyConfig';
import type { AIDecision } from './RealTimeAI';
import { logger } from 'multiplayer-framework/shared';

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
        if (sourcePlanets.length === 0) {
            return null;
        }

        // Sort by most ships and pick the best source
        sourcePlanets.sort((a, b) => b.ships - a.ships);
        const source = sourcePlanets[0];

        // Find the best target
        const bestTarget = this.findBestTarget(source, this.gameState.planets, player, difficulty, config);
        if (!bestTarget) {
            // Fallback: for hard/medium AI, try to find any viable target
            if (difficulty === 'hard' || difficulty === 'medium') {
                const viableTarget = this.findAnyViableTarget(source, this.gameState.planets, player, config, difficulty);
                if (viableTarget) {
                    const shipsToSend = this.calculateShipsToSend(source, viableTarget, difficulty, config);
                    if (shipsToSend >= config.attack.minShipsToSend && this.isViableAttack(source, viableTarget, shipsToSend)) {
                        return {
                            type: 'send_armada',
                            sourcePlanetId: source.id,
                            destinationPlanetId: viableTarget.id,
                            shipCount: shipsToSend,
                        };
                    }
                }
            }
            return null;
        }

        // Validate target planet still exists in game state
        const validatedTarget = this.gameState.getPlanet(bestTarget.id);
        if (!validatedTarget) {
            return null;
        }

        // Use validated target (might have different ship count)
        const target = validatedTarget;

        // Calculate ships to send
        const shipsToSend = this.calculateShipsToSend(source, target, difficulty, config);
        if (shipsToSend < config.attack.minShipsToSend) {
            return null;
        }

        // Validate that the attack is viable (not suicidal)
        if (!this.isViableAttack(source, target, shipsToSend)) {
            logger.info(
                `[AttackStrategy] AI ${player.name} (${difficulty}) attack not viable: ` +
                `source=${source.id} (${source.ships} ships), target=${target.id} (${target.ships} ships), ` +
                `shipsToSend=${shipsToSend}`
            );
            return null;
        }

        return {
            type: 'send_armada',
            sourcePlanetId: source.id,
            destinationPlanetId: target.id,
            shipCount: shipsToSend,
        };
    }

    /**
     * Find planets that can serve as sources for attacks
     */
    private findSourcePlanetsForAttack(myPlanets: Planet[], difficulty: AiDifficulty, config: AIDifficultyConfig): Planet[] {
        const minSourceShips = config.attack.minSourceShips;

        // Find planets with excess ships (threshold varies by difficulty)
        let sourcePlanets = myPlanets.filter(p => p.ships >= minSourceShips);

        if (sourcePlanets.length === 0) {
            // If no planets meet the threshold, try with lower threshold for hard AI
            // For hard AI, minSourceShips is already 2, so try with 1 ship minimum
            if (difficulty === 'hard') {
                const lowerThresholdPlanets = myPlanets.filter(p => p.ships >= 1);
                if (lowerThresholdPlanets.length > 0) {
                    sourcePlanets = lowerThresholdPlanets;
                }
            }
        }

        return sourcePlanets;
    }

    /**
     * Find the best target planet for an attack from the given source
     */
    private findBestTarget(source: Planet, allPlanets: Planet[], player: Player, difficulty: AiDifficulty, config: AIDifficultyConfig): Planet | null {
        const minAdvantage = config.attack.minAdvantage;
        let bestTarget: Planet | null = null;
        let bestScore = -Infinity;

        for (const target of allPlanets) {
            if (target.ownerId === player.slotIndex) continue;

            // Only consider if we have advantage (threshold varies by difficulty)
            // For hard AI with minAdvantage = 0, this means source.ships >= target.ships (can attack when equal or better)
            // For easy/medium with minAdvantage > 0, requires more advantage
            // Use < instead of <= to allow equal strength attacks when minAdvantage = 0
            if (source.ships < target.ships + minAdvantage) continue;

            const score = this.scoreTargetPlanet(target, source, player, difficulty);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        // For hard AI: if no target meets the advantage threshold, use aggressive fallback
        // This allows attacking even when slightly outnumbered if we can send enough ships to win
        if (!bestTarget && difficulty === 'hard') {
            for (const target of allPlanets) {
                if (target.ownerId === player.slotIndex) continue;

                // For hard AI, be aggressive - consider targets where we can send enough ships to win
                // even if we don't have the minAdvantage requirement
                // Calculate how many ships we'd need to send to have a good chance of winning
                const testShips = this.calculateShipsToSend(source, target, difficulty, config);

                // Allow attack if:
                // 1. We can send at least as many ships as the target has (or close to it)
                // 2. We have enough ships available (accounting for defenseBuffer)
                // 3. The attack is viable
                if (testShips >= target.ships &&
                    testShips >= config.attack.minShipsToSend &&
                    testShips <= source.ships - config.attack.defenseBuffer &&
                    this.isViableAttack(source, target, testShips)) {
                    const score = this.scoreTargetPlanet(target, source, player, difficulty);
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = target;
                    }
                }
            }
        }

        return bestTarget;
    }

    /**
     * Find any viable target for hard/medium AI when normal criteria don't match
     * Only considers targets where we can send enough ships to have a reasonable chance of winning
     */
    private findAnyViableTarget(source: Planet, allPlanets: Planet[], player: Player, config: AIDifficultyConfig, difficulty: AiDifficulty): Planet | null {
        let bestTarget: Planet | null = null;
        let bestScore = -Infinity;

        for (const target of allPlanets) {
            if (target.ownerId === player.slotIndex) continue;

            // For hard AI: consider targets where we have at least 90% of their strength
            // For medium AI: consider targets where we have at least 95% of their strength (slightly more conservative)
            const strengthThreshold = difficulty === 'hard' ? 0.9 : 0.95;
            if (source.ships < target.ships * strengthThreshold) continue;

            // Verify we can send enough ships to win
            const testShips = this.calculateShipsToSend(source, target, difficulty, config);
            if (testShips < config.attack.minShipsToSend) continue;
            if (!this.isViableAttack(source, target, testShips)) continue;

            const score = this.scoreTargetPlanet(target, source, player, difficulty);
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
    private scoreTargetPlanet(target: Planet, source: Planet, player: Player, difficulty: AiDifficulty): number {
        const distance = getDistanceBetweenPlanets(source, target);
        const isNeutral = target.ownerId === null;
        const isEnemy = !isNeutral && target.ownerId !== player.slotIndex;

        let score = 0;
        score -= target.ships * 10; // Prefer fewer defenders
        score += isNeutral ? 10 : 0; // Slight preference for neutrals

        // For hard AI, prioritize enemy planets over neutrals and closer targets more heavily
        if (difficulty === 'hard') {
            score += isEnemy ? 20 : 0; // Strong preference for enemy planets
            score -= distance / 5; // Prefer closer targets (more weight)
        } else {
            score -= distance / 10; // Prefer closer targets
        }

        score += target.volume / 5; // Prefer larger planets

        return score;
    }

    /**
     * Calculate how many ships to send in an attack
     * Ensures hard AI always sends enough ships to have a reasonable chance of winning
     */
    private calculateShipsToSend(source: Planet, target: Planet, difficulty: AiDifficulty, config: AIDifficultyConfig): number {
        const minShipsToSend = config.attack.minShipsToSend;
        const defenseBuffer = config.attack.defenseBuffer;

        // Calculate base ships needed
        let shipsNeeded: number;
        if (difficulty === 'hard') {
            // For hard AI, use more aggressive multiplier (1.3x) but ensure minimum
            // Always send at least target.ships + 1 to have a chance of winning
            shipsNeeded = Math.max(
                target.ships + 1,
                Math.ceil(target.ships * 1.3)
            );
        } else {
            // For easy/medium, use conservative multiplier
            shipsNeeded = Math.max(
                minShipsToSend,
                Math.floor(target.ships * 1.5)
            );
        }

        // Never send fewer ships than the target has defenders (unless target has 0-1 ships)
        if (target.ships > 1) {
            shipsNeeded = Math.max(shipsNeeded, target.ships);
        }

        // Cap at available ships minus defense buffer
        const maxAvailable = source.ships - defenseBuffer;
        return Math.min(maxAvailable, Math.max(minShipsToSend, shipsNeeded));
    }

    /**
     * Validate that an attack is viable (not suicidal)
     * Ensures we're sending enough ships to have a reasonable chance of winning
     */
    private isViableAttack(source: Planet, target: Planet, shipsToSend: number): boolean {
        // Can't send more ships than we have
        if (shipsToSend > source.ships) return false;

        // Can't send fewer ships than the target has defenders (unless target has 0-1 ships)
        if (target.ships > 1 && shipsToSend < target.ships) return false;

        // Must send at least 1 ship
        if (shipsToSend < 1) return false;

        return true;
    }
}

