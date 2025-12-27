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
     */
    processAITurns(): AIDecision[] {
        const decisions: AIDecision[] = [];
        const now = Date.now();

        for (const player of this.gameState.players) {
            if (!player.isAI) continue;
            if (this.gameState.isPlayerEliminated(player.slotIndex)) continue;

            const difficulty = this.playerDifficulties[player.slotIndex] || 'easy';
            const cooldown = this.getCooldownForDifficulty(difficulty);

            // Check cooldown (using persisted state)
            const lastDecision = this.gameState.getAILastDecisionTime(player.slotIndex);
            if (now - lastDecision < cooldown) continue;

            const decision = this.makeDecision(player, difficulty);
            if (decision.type !== 'wait') {
                decisions.push(decision);
                this.gameState.setAILastDecisionTime(player.slotIndex, now);
                this.decisionExecutor.executeDecision(player, decision);
            }
        }

        return decisions;
    }

    /**
     * Make a decision for an AI player
     * For hard AI: prioritize attacks over builds (more aggressive)
     * For easy/medium: prioritize builds over attacks (more defensive)
     */
    private makeDecision(player: Player, difficulty: AiDifficulty): AIDecision {
        const myPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
        
        if (myPlanets.length === 0) {
            return { type: 'wait' };
        }

        // For hard AI, prioritize attacks over builds (more aggressive)
        if (difficulty === 'hard') {
            // Try to attack first
            const attackDecision = this.attackStrategy.findAttackOpportunity(player, myPlanets, difficulty);
            if (attackDecision) return attackDecision;

            // Then try to build ships
            const buildDecision = this.buildStrategy.findBuildOpportunity(player, myPlanets, difficulty);
            if (buildDecision) return buildDecision;

            // Fallback: try to find any viable attack from strongest planet to weakest viable target
            const fallbackAttack = this.findFallbackAttack(player, myPlanets, difficulty);
            if (fallbackAttack) return fallbackAttack;
        } else {
            // For easy/medium, prioritize builds over attacks (more defensive)
            const buildDecision = this.buildStrategy.findBuildOpportunity(player, myPlanets, difficulty);
            if (buildDecision) return buildDecision;

            const attackDecision = this.attackStrategy.findAttackOpportunity(player, myPlanets, difficulty);
            if (attackDecision) return attackDecision;
        }

        return { type: 'wait' };
    }
    
    /**
     * Fallback attack logic for hard AI when no good opportunities are found
     * Finds strongest planet and weakest viable enemy/neutral target
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
            
            // Only consider if we have at least 90% of their strength
            if (source.ships < planet.ships * 0.9) continue;
            
            // Calculate if we can send enough ships to win
            const shipsToSend = this.calculateFallbackShipsToSend(source, planet, config);
            if (shipsToSend < config.attack.minShipsToSend) continue;
            
            // Validate attack is viable
            if (shipsToSend > source.ships) continue;
            if (planet.ships > 1 && shipsToSend < planet.ships) continue;
            
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
        // Always send at least target.ships + 1 to have a chance of winning
        const minToWin = target.ships > 1 ? target.ships + 1 : Math.max(2, target.ships + 1);
        // Or use 1.3x multiplier, whichever is higher
        const calculated = Math.max(minToWin, Math.ceil(target.ships * 1.3));
        
        // Cap at available ships (hard AI has defenseBuffer = 0, so can use all ships)
        return Math.min(source.ships, Math.max(config.attack.minShipsToSend, calculated));
    }
}

/**
 * Process AI turns for a game state
 */
export function processAITurns(gameState: GalacticGameState): AIDecision[] {
    const ai = new RealTimeAI(gameState);
    return ai.processAITurns();
}
