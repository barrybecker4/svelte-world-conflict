/**
 * Build Strategy for AI
 * Handles all build-related decision logic
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import type { Planet, Player, AiDifficulty } from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { getAIDifficultyConfig, type AIDifficultyConfig } from './aiDifficultyConfig';
import type { AIDecision } from './RealTimeAI';
import { logger } from 'multiplayer-framework/shared';

/**
 * Build strategy for finding and evaluating build opportunities
 */
export class BuildStrategy {
    constructor(private gameState: GalacticGameState) {}

    /**
     * Find opportunity to build ships
     */
    findBuildOpportunity(player: Player, myPlanets: Planet[], difficulty: AiDifficulty): AIDecision | null {
        // Check global player resources (resources are stored per player, not per planet)
        const playerResources = this.gameState.getPlayerResources(player.slotIndex);
        const config = getAIDifficultyConfig(difficulty);

        // Difficulty-based resource threshold
        const minResources = GALACTIC_CONSTANTS.SHIP_COST * config.build.resourceMultiplier;

        // Check if player has enough resources
        if (playerResources < minResources) {
            return null;
        }

        // Find candidate planets to build at
        const candidatePlanets = this.findCandidatePlanetsForBuild(myPlanets, config);
        if (candidatePlanets.length === 0) {
            return null;
        }

        // Sort by ships (fewest first) to prioritize vulnerable planets
        candidatePlanets.sort((a, b) => a.ships - b.ships);
        const targetPlanet = candidatePlanets[0];

        // Calculate how many ships to build
        const shipsToBuild = this.calculateShipsToBuild(playerResources, config);
        if (shipsToBuild < 1) {
            return null;
        }

        return {
            type: 'build_ships',
            sourcePlanetId: targetPlanet.id,
            shipCount: shipsToBuild,
        };
    }

    /**
     * Find candidate planets where ships can be built
     * Prioritizes vulnerable planets (those with fewer ships)
     */
    private findCandidatePlanetsForBuild(myPlanets: Planet[], config: AIDifficultyConfig): Planet[] {
        const minShipsOnPlanet = config.build.minShipsOnPlanet;

        // Filter for vulnerable planets (those with ships <= threshold)
        // For hard AI with minShipsOnPlanet = 0, this means planets with 0 ships
        // For easy/medium, this means planets with few ships
        let candidatePlanets = myPlanets.filter(p => p.ships <= minShipsOnPlanet || myPlanets.length === 1);

        // If no planets meet the threshold, fall back to all planets
        // This ensures we can always build somewhere
        if (candidatePlanets.length === 0) {
            candidatePlanets = [...myPlanets];
        }

        return candidatePlanets;
    }

    /**
     * Calculate how many ships to build based on available resources
     */
    private calculateShipsToBuild(playerResources: number, config: AIDifficultyConfig): number {
        const maxShipsFromResources = Math.floor(playerResources / GALACTIC_CONSTANTS.SHIP_COST);
        const maxBuildAtOnce = config.build.maxBuildAtOnce;
        return Math.min(maxShipsFromResources, maxBuildAtOnce);
    }
}

