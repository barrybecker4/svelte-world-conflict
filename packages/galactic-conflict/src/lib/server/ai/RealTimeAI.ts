/**
 * Real-Time AI for Galactic Conflict
 * Orchestrates AI decision-making for all AI players in real-time gameplay
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Player, AiDifficulty, Planet } from '$lib/game/entities/gameTypes';
import { getAIDifficultyConfig, type AIDifficultyConfig } from './aiDifficultyConfig';
import { AttackStrategy } from './AttackStrategy';
import { BuildStrategy } from './BuildStrategy';
import { DecisionExecutor } from './DecisionExecutor';
import { logger } from 'multiplayer-framework/shared';

export interface AIDecision {
    type: 'send_armada' | 'build_ships' | 'wait';
    sourcePlanetId?: number;
    destinationPlanetId?: number;
    shipCount?: number;
}

/**
 * Process AI decisions for all AI players
 * Orchestrates timing, cooldowns, and decision priority
 */
export class RealTimeAI {
    private playerDifficulties: Record<number, AiDifficulty> = {};
    private attackStrategy: AttackStrategy;
    private buildStrategy: BuildStrategy;
    private decisionExecutor: DecisionExecutor;

    constructor(private gameState: GalacticGameState) {
        // Store difficulty for each AI player
        for (const player of gameState.players) {
            if (player.isAI) {
                this.playerDifficulties[player.slotIndex] = player.difficulty || 'easy';
            }
        }

        // Initialize strategies
        this.attackStrategy = new AttackStrategy(gameState);
        this.buildStrategy = new BuildStrategy(gameState);
        this.decisionExecutor = new DecisionExecutor(gameState);
    }

    /**
     * Get cooldown time based on difficulty
     */
    private getCooldownForDifficulty(difficulty: AiDifficulty): number {
        return getAIDifficultyConfig(difficulty).cooldown;
    }

    /**
     * Process decisions for all AI players
     * @param currentTime - Current game time (for consistency with game state time tracking)
     */
    processAITurns(currentTime?: number): AIDecision[] {
        const decisions: AIDecision[] = [];
        // Use currentTime if provided (for consistency with game state), otherwise fall back to Date.now()
        const now = currentTime ?? Date.now();


        for (const player of this.gameState.players) {
            if (!player.isAI) continue;
            if (this.gameState.isPlayerEliminated(player.slotIndex)) continue;

            const difficulty = this.playerDifficulties[player.slotIndex] || 'easy';
            const cooldown = this.getCooldownForDifficulty(difficulty);

            // Check cooldown (using persisted state)
            const lastDecision = this.gameState.getAILastDecisionTime(player.slotIndex);
            if (now - lastDecision < cooldown) continue;

            const playerDecisions = this.makeDecisions(player, difficulty);
            
            // Execute all decisions (can be multiple: attack + build)
            let hasNonWaitDecision = false;
            for (const decision of playerDecisions) {
                if (decision.type !== 'wait') {
                    hasNonWaitDecision = true;
                    decisions.push(decision);
                    this.decisionExecutor.executeDecision(player, decision);
                }
            }
            
            // Update cooldown only if we made at least one non-wait decision
            if (hasNonWaitDecision) {
                this.gameState.setAILastDecisionTime(player.slotIndex, now);
            }
        }

        return decisions;
    }

    /**
     * Make decisions for an AI player
     * Can return multiple decisions (both build and attack) if both are appropriate
     * For hard AI: prioritize attacks over builds (more aggressive)
     * For easy/medium: prioritize builds over attacks (more defensive)
     */
    private makeDecisions(player: Player, difficulty: AiDifficulty): AIDecision[] {
        const myPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
        const decisions: AIDecision[] = [];

        if (myPlanets.length === 0) {
            return [{ type: 'wait' }];
        }

        // Try to find both attack and build opportunities
        const attackDecision = this.attackStrategy.findAttackOpportunity(player, myPlanets, difficulty);
        const buildDecision = this.buildStrategy.findBuildOpportunity(player, myPlanets, difficulty);

        // For hard AI, prioritize attacks over builds (more aggressive)
        if (difficulty === 'hard') {
            // Add attack if available
            if (attackDecision) {
                decisions.push(attackDecision);
            } else {
                // Fallback: try to find any viable attack from strongest planet to weakest viable target
                const fallbackAttack = this.findFallbackAttack(player, myPlanets, difficulty);
                if (fallbackAttack) {
                    decisions.push(fallbackAttack);
                }
            }

            // Add build if available (can do both)
            if (buildDecision) {
                decisions.push(buildDecision);
            }
        } else {
            // For easy/medium, check if we have planets with enough ships to attack
            const config = getAIDifficultyConfig(difficulty);
            const hasAttackablePlanets = myPlanets.some(p => p.ships >= config.attack.minSourceShips);

            if (hasAttackablePlanets) {
                // If we have planets that can attack, prioritize attacks
                if (attackDecision) {
                    decisions.push(attackDecision);
                }

                // Then add build (can do both)
                if (buildDecision) {
                    decisions.push(buildDecision);
                }
            } else {
                // If we don't have attackable planets, prioritize building
                if (buildDecision) {
                    decisions.push(buildDecision);
                }

                // Then try attacking (in case lower threshold works)
                if (attackDecision) {
                    decisions.push(attackDecision);
                }
            }
        }

        // If no decisions were made, return wait
        if (decisions.length === 0) {
            return [{ type: 'wait' }];
        }

        return decisions;
    }

    /**
     * Fallback attack logic for hard AI when no good opportunities are found
     * Finds strongest planet and weakest viable enemy/neutral target
     * More aggressive - allows attacking when slightly outnumbered
     */
    private findFallbackAttack(player: Player, myPlanets: Planet[], difficulty: AiDifficulty): AIDecision | null {
        if (difficulty !== 'hard') return null;

        // Find strongest planet
        const sortedPlanets = [...myPlanets].sort((a, b) => b.ships - a.ships);
        const source = sortedPlanets[0];
        if (!source || source.ships < 2) return null;

        // Find weakest viable enemy/neutral planet
        const config = getAIDifficultyConfig(difficulty);
        let bestTarget: Planet | null = null;
        let bestScore = Infinity; // Lower is better (fewer ships)

        for (const planet of this.gameState.planets) {
            if (planet.ownerId === player.slotIndex) continue;

            // Calculate if we can send enough ships to win
            const shipsToSend = this.calculateFallbackShipsToSend(source, planet, config);
            if (shipsToSend < config.attack.minShipsToSend) continue;

            // Validate attack is viable:
            // 1. Can't send more than available (accounting for defenseBuffer)
            if (shipsToSend > source.ships - config.attack.defenseBuffer) continue;
            // 2. Must be able to send at least as many ships as target has to have a chance
            if (shipsToSend < planet.ships) continue;

            // Score by fewest ships (prefer weakest targets)
            const score = planet.ships;
            if (score < bestScore) {
                bestScore = score;
                bestTarget = planet;
            }
        }

        if (!bestTarget) return null;

        const shipsToSend = this.calculateFallbackShipsToSend(source, bestTarget, config);
        if (shipsToSend < config.attack.minShipsToSend) return null;

        return {
            type: 'send_armada',
            sourcePlanetId: source.id,
            destinationPlanetId: bestTarget.id,
            shipCount: shipsToSend,
        };
    }

    /**
     * Calculate ships to send for fallback attack
     * Ensures we send enough to have a reasonable chance of winning
     */
    private calculateFallbackShipsToSend(source: Planet, target: Planet, config: AIDifficultyConfig): number {
        // Always send at least target.ships to have a chance of winning
        const minToWin = target.ships > 1 ? target.ships : Math.max(2, target.ships);
        // Or use 1.3x multiplier, whichever is higher
        const calculated = Math.max(minToWin, Math.ceil(target.ships * 1.3));

        // Cap at available ships (accounting for defenseBuffer)
        const maxAvailable = source.ships - config.attack.defenseBuffer;
        return Math.min(maxAvailable, Math.max(config.attack.minShipsToSend, calculated));
    }
}

/**
 * Process AI turns for a game state
 * @param gameState - The game state
 * @param currentTime - Optional current time (for consistency with game state time tracking)
 */
export function processAITurns(gameState: GalacticGameState, currentTime?: number): AIDecision[] {
    const ai = new RealTimeAI(gameState);
    return ai.processAITurns(currentTime);
}
