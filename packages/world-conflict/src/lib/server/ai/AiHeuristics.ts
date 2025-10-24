/**
 * AI Heuristics Module
 * Position evaluation functions for minimax AI decision-making
 */

import type { GameState, Player, Region, Temple } from '$lib/game/state/GameState';
import { sumBy, maxBy, contains, clamp } from '$lib/game/utils/arrayUtils';
import { AI_LEVELS, type AiLevel } from '$lib/game/entities/aiPersonalities';

/**
 * Map difficulty string to AI level number
 */
export function getAiLevelFromDifficulty(difficulty?: string): AiLevel {
    switch (difficulty) {
        case 'Nice':
            return AI_LEVELS.NICE; // 0
        case 'Normal':
            return AI_LEVELS.RUDE; // 1
        case 'Hard':
            return AI_LEVELS.MEAN; // 2
        default:
            return AI_LEVELS.RUDE; // 1 - default to Normal
    }
}

/**
 * Main heuristic evaluation function for a player's position
 * Higher values = better position for the player
 */
export function heuristicForPlayer(player: Player, state: GameState, aiLevel: AiLevel): number {
    const soldierBonus = slidingBonus(state, 0.25, 0, 0.83);
    const threatOpportunityMultiplier = slidingBonus(state, 1.0, 0.0, 0.83);

    function adjustedRegionValue(region: Region): number {
        // Count the value of the region itself
        let value = regionFullValue(state, region.index);
        // Take into account threats and opportunities
        value += regionOpportunity(state, player, region.index, aiLevel) * threatOpportunityMultiplier -
                 regionThreat(state, player, region.index, aiLevel) * threatOpportunityMultiplier * value;
        // Add the value of soldiers on it
        value += state.soldierCount(region.index) * soldierBonus;

        return value;
    }

    const regionTotal = sumBy(state.regions, region => {
        return state.isOwnedBy(region.index, player) ? adjustedRegionValue(region) : 0;
    });

    // Each point of faith counts as 1/12th of a soldier
    const faithTotal = state.income(player) * soldierBonus / 12;

    return regionTotal + faithTotal;
}

/**
 * Calculate how dangerous/valuable a temple position is
 * Used for deciding where to build upgrades or soldiers
 */
export function templeDangerousness(state: GameState, temple: Temple, aiLevel: AiLevel): number {
    const templeOwner = state.getPlayerBySlotIndex(state.owner(temple.regionIndex) || 0);
    if (!templeOwner) return 0;

    return regionThreat(state, templeOwner, temple.regionIndex, aiLevel) +
           regionOpportunity(state, templeOwner, temple.regionIndex, aiLevel);
}

/**
 * Calculate the full strategic value of a region
 * Considers temple presence and upgrades
 */
export function regionFullValue(state: GameState, regionIdx: number): number {
    const temple = state.state.templesByRegion[regionIdx];

    if (temple) {
        const templeBonus = slidingBonus(state, 6, 0, 0.5);
        const upgradeBonus = slidingBonus(state, 4, 0, 0.9);
        const upgradeValue = temple.upgradeIndex ? (temple.level + 1) : 0;
        return 1 + templeBonus + upgradeBonus * upgradeValue;
    } else {
        return 1;
    }
}

/**
 * Calculate threat level to a region from enemy forces
 * Uses breadth-first search to find enemies within N moves
 * Depth varies by AI difficulty level
 */
export function regionThreat(state: GameState, player: Player, regionIndex: number, aiLevel: AiLevel): number {
    if (aiLevel === AI_LEVELS.NICE) {
        return 0; // 'Nice' AI doesn't consider threat
    }

    const ourPresence = state.soldierCount(regionIndex);
    const region = state.regions[regionIndex];

    if (!region || !region.neighbors) {
        return 0;
    }

    const enemyPresence = maxBy(region.neighbors, (neighborIdx: number) => {
        // Is this an enemy region?
        const nbrOwner = state.owner(neighborIdx);
        const nbrPlayer = nbrOwner !== undefined ? state.getPlayerBySlotIndex(nbrOwner) : null;
        if (!nbrPlayer || state.isOwnedBy(neighborIdx, player)) {
            return 0;
        }

        // Count soldiers that can reach us in moves from this direction using BFS
        // 'Rude' AI only looks at direct neighbors, harder AIs look deeper
        const depth = (aiLevel === AI_LEVELS.RUDE) ? 0 : 2;
        const queue: Array<{ region: Region; depth: number }> = [{ region: state.regions[neighborIdx], depth }];
        const visited: Region[] = [];
        let total = 0;

        while (queue.length > 0) {
            const entry = queue.shift()!;
            // Soldiers further away count for less (for MEAN AI)
            total += state.soldierCount(entry.region.index) * ((aiLevel > AI_LEVELS.RUDE) ? (2 + entry.depth) / 4 : 1);
            visited.push(entry.region);

            if (entry.depth > 0) {
                // Go deeper with the search
                const unvisitedNeighbors = (entry.region.neighbors || []).filter((candidateIdx: number) => {
                    const candidateRegion = state.regions[candidateIdx];
                    return !contains(visited, candidateRegion) &&
                           state.isOwnedBy(candidateIdx, nbrPlayer);
                });

                unvisitedNeighbors.forEach((i: number) =>
                    queue.push({ region: state.regions[i], depth: entry.depth - 1 })
                );
            }
        }

        return total;
    }) || 0;

    const clampHigh = (aiLevel === AI_LEVELS.RUDE) ? 0.5 : 1.1;
    const threatLevel = (enemyPresence / (ourPresence + 0.0001) - 1) / 1.5;
    return clamp(threatLevel, 0, clampHigh);
}

/**
 * Calculate conquest opportunity from a region
 * How likely is this region to conquer neighbors?
 */
export function regionOpportunity(state: GameState, player: Player, regionIndex: number, aiLevel: AiLevel): number {
    // 'Nice' AI doesn't see opportunities
    if (aiLevel === AI_LEVELS.NICE) {
        return 0;
    }

    // How much conquest does this region enable?
    const attackingSoldiers = state.soldierCount(regionIndex);
    if (!attackingSoldiers) {
        return 0;
    }

    const region = state.regions[regionIndex];
    if (!region || !region.neighbors) {
        return 0;
    }

    return sumBy(region.neighbors, (neighborIdx: number) => {
        if (state.isOwnedBy(neighborIdx, player)) {
            const defendingSoldiers = state.soldierCount(neighborIdx);
            const opp = (attackingSoldiers / (defendingSoldiers + 0.01) - 0.9) * 0.5;
            return clamp(opp, 0, 0.5) * regionFullValue(state, neighborIdx);
        } else {
            return 0;
        }
    });
}

/**
 * Calculate sliding bonuses that change through game phases
 * Values transition from early game to late game
 */
export function slidingBonus(state: GameState, startOfGameValue: number, endOfGameValue: number, dropOffPoint: number): number {
    const maxTurns = state.maxTurns || 100;
    const dropOffTurn = dropOffPoint * maxTurns;
    let alpha = (state.turnNumber - dropOffTurn) / (maxTurns - dropOffTurn);

    if (alpha < 0.0) {
        alpha = 0.0;
    }

    return startOfGameValue + (endOfGameValue - startOfGameValue) * alpha;
}

