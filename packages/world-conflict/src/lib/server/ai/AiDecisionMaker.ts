/**
 * AI Decision Maker
 * High-level AI decision logic for soldiers, upgrades, and movement
 */
import type { GameState, Player } from '$lib/game/state/GameState';
import type { Command } from '$lib/game/commands/Command';
import { BuildCommand } from '$lib/game/commands/BuildCommand';
import { EndTurnCommand } from '$lib/game/commands/EndTurnCommand';
import { miniMaxSearch } from './MiniMaxSearch';
import { templeDangerousness, getAiLevelFromDifficulty } from './AiHeuristics';
import { TEMPLE_UPGRADES_BY_NAME, type TempleUpgradeDefinition } from '$lib/game/constants/templeUpgradeDefinitions';
import { AI_PERSONALITIES, type AiLevel } from '$lib/game/entities/aiPersonalities';
import { maxBy, minBy } from '$lib/game/utils/arrayUtils';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Main entry point for AI move selection
 * Decides whether to build soldiers, upgrades, or move armies
 */
export async function pickAiMove(player: Player, state: GameState): Promise<Command> {
    // Skip players that are no longer in the game
    if (state.regionCount(player) === 0) {
        return new EndTurnCommand(state, player);
    }

    // Get AI difficulty level from game state
    const aiLevel = getAiLevelFromDifficulty(state.state.aiDifficulty);

    // Priority 1: Check for soldier building
    if (shouldBuildSoldier(player, state, aiLevel)) {
        const move = buildSoldierAtBestTemple(player, state, aiLevel);
        if (move) return move;
    }

    // Priority 2: Check for temple upgrades
    const upgrade = upgradeToBuild(player, state, aiLevel);
    if (upgrade) {
        return upgrade;
    }

    // Priority 3: Use minimax to find best army movement
    const depth = state.movesRemaining || 1;
    const maxThinkTime = GAME_CONSTANTS.AI_THINK_TIME;

    return await miniMaxSearch(player, state, depth, maxThinkTime, aiLevel);
}

/**
 * Determine if AI should build a soldier
 */
function shouldBuildSoldier(player: Player, state: GameState, aiLevel: AiLevel): boolean {
    // Do we have a temple to build it in?
    const temples = state.templesForPlayer(player);
    if (temples.length === 0) {
        return false;
    }

    // Get personality preferences
    const personality = getPlayerPersonality(player);
    if (!personality) {
        return false;
    }

    // Get preference for soldiers from personality
    const soldierEagerness = getEffectiveSoldierEagerness(personality, player, state);

    // Calculate the relative cost of buying a soldier now
    const soldierCost = state.soldierCost();
    const playerFaith = state.getPlayerFaith(player.slotIndex);
    const relativeCost = soldierCost / playerFaith;

    if (relativeCost > 1) {
        return false; // Can't afford it
    }

    // See how far behind on soldiers we are compared to other players
    const forces = state.players.map(p => calculateForce(state, p));
    const maxForce = Math.max(...forces);
    const ourForce = calculateForce(state, player);
    const forceDisparity = maxForce / (ourForce || 1);

    // Calculate whether we should build now
    // The further behind we are, the more likely to spend cash on soldiers
    const decisionFactor = forceDisparity * soldierEagerness - relativeCost;
    return decisionFactor >= 0;
}

/**
 * Calculate military force (regions + soldiers)
 */
function calculateForce(state: GameState, player: Player): number {
    return state.regionCount(player) * 2 + state.totalSoldiers(player);
}

/**
 * Build a soldier at the most appropriate temple
 */
function buildSoldierAtBestTemple(player: Player, state: GameState, aiLevel: AiLevel): Command | null {
    const temples = state.templesForPlayer(player);
    if (temples.length === 0) return null;

    // Build at the most dangerous temple (under threat)
    const temple = maxBy(temples, t => templeDangerousness(state, t, aiLevel));
    if (!temple) return null;

    return new BuildCommand(state, player, temple.regionIndex, TEMPLE_UPGRADES_BY_NAME.SOLDIER.index);
}

/**
 * Determine which upgrade to build based on personality
 */
function upgradeToBuild(player: Player, state: GameState, aiLevel: AiLevel): Command | null {
    const personality = getPlayerPersonality(player);
    if (!personality) return null;

    // Do we want an upgrade?
    const desiredUpgrade = findDesiredUpgrade(personality.upgradePreference, player, state);
    if (!desiredUpgrade) {
        return null;
    }

    const desiredLevel = state.rawUpgradeLevel(player, desiredUpgrade);

    // Can we afford it?
    const playerFaith = state.getPlayerFaith(player.slotIndex);
    const cost = desiredUpgrade.cost[desiredLevel] || 0;
    if (playerFaith < cost) {
        return null;
    }

    // Do we have a place to build it?
    const temples = state.templesForPlayer(player);
    const possibleTemplesToUpgrade = temples.filter(temple => {
        return (!temple.upgradeIndex && !desiredLevel) || (temple.upgradeIndex === desiredUpgrade.index);
    });

    if (possibleTemplesToUpgrade.length === 0) {
        return null;
    }

    // Pick the safest temple (least threatened)
    const temple = minBy(possibleTemplesToUpgrade, t => templeDangerousness(state, t, aiLevel));
    if (!temple) return null;

    // Build the upgrade!
    return new BuildCommand(state, player, temple.regionIndex, desiredUpgrade.index);
}

/**
 * Find the next upgrade the AI desires based on personality preferences
 */
function findDesiredUpgrade(preferredUpgrades: number[], player: Player, state: GameState): TempleUpgradeDefinition | null {
    const playerTemples = state.templesForPlayer(player);

    // Find the first preferred upgrade for which we do not have the desired max level
    for (const upgradeIndex of preferredUpgrades) {
        const upgradeDef = Object.values(TEMPLE_UPGRADES_BY_NAME).find(u => u.index === upgradeIndex);
        if (!upgradeDef) continue;

        const templeWithUpgrade = playerTemples.find(temple => temple.upgradeIndex === upgradeIndex);

        if (templeWithUpgrade) {
            // We have this upgrade - check if we can level it up
            const currentLevel = templeWithUpgrade.level || 0;
            const maxLevel = upgradeDef.cost.length - 1;

            if (currentLevel < maxLevel) {
                return upgradeDef; // We want to upgrade this further
            }
        } else {
            // We don't have this upgrade yet
            return upgradeDef;
        }
    }

    return null;
}

/**
 * Get the effective soldier eagerness for a personality
 * Returns 1.0 if no more upgrades are desired
 */
function getEffectiveSoldierEagerness(personality: any, player: Player, state: GameState): number {
    const desiredUpgrade = findDesiredUpgrade(personality.upgradePreference, player, state);

    // If we don't want more upgrades, focus entirely on soldiers
    if (!desiredUpgrade) {
        return 1.0;
    }

    return personality.soldierEagerness;
}

/**
 * Get the AI personality for a player
 */
function getPlayerPersonality(player: Player): any | null {
    if (!player.personality) {
        return null;
    }

    // Look up personality by name from the AI_PERSONALITIES array
    const personality = AI_PERSONALITIES.find(p => p.name === player.personality);
    return personality || null;
}

