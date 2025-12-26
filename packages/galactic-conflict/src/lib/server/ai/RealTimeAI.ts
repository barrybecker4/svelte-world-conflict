/**
 * Real-Time AI for Galactic Conflict
 * Orchestrates AI decision-making for all AI players in real-time gameplay
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { getAIDifficultyConfig } from './aiDifficultyConfig';
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
    private lastDecisionTime: Record<number, number> = {};
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

            // Check cooldown
            const lastDecision = this.lastDecisionTime[player.slotIndex] || 0;
            if (now - lastDecision < cooldown) continue;

            const decision = this.makeDecision(player, difficulty);
            if (decision.type !== 'wait') {
                decisions.push(decision);
                this.lastDecisionTime[player.slotIndex] = now;
                this.decisionExecutor.executeDecision(player, decision);
            }
        }

        return decisions;
    }

    /**
     * Make a decision for an AI player
     * Prioritize decisions:
     *    1. Build ships when resources are high (reinforce vulnerable planets)
     *    2. Attack weak enemy/neutral planets
     */
    private makeDecision(player: Player, difficulty: AiDifficulty): AIDecision {
        const myPlanets = this.gameState.getPlanetsOwnedBy(player.slotIndex);
        
        if (myPlanets.length === 0) {
            return { type: 'wait' };
        }

        // Try to build ships first (reinforce vulnerable planets)
        const buildDecision = this.buildStrategy.findBuildOpportunity(player, myPlanets, difficulty);
        if (buildDecision) return buildDecision;

        // Try to attack
        const attackDecision = this.attackStrategy.findAttackOpportunity(player, myPlanets, difficulty);
        if (attackDecision) return attackDecision;

        return { type: 'wait' };
    }
}

/**
 * Process AI turns for a game state
 */
export function processAITurns(gameState: GalacticGameState): AIDecision[] {
    const ai = new RealTimeAI(gameState);
    return ai.processAITurns();
}
