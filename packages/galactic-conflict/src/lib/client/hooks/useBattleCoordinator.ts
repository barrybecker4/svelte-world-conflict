import type { 
    GalacticGameStateData, 
    Planet, 
    PlayerEliminationEvent 
} from '$lib/game/entities/gameTypes';
import type { BattleAnimationState } from '$lib/client/stores/battleAnimationStore';
import { 
    battleAnimations, 
    processNewBattleReplays 
} from '$lib/client/stores/battleAnimationStore';
import { extractReplayIds, hasNewReplays } from '$lib/client/utils/eventProcessing';

/**
 * Hook that coordinates battle animations with game state
 * Manages replay processing and planet display states during battles
 */
export function useBattleCoordinator() {
    // Track which replays we've already processed
    let lastReplayIds: string[] = [];

    // Track pending elimination texts that should be shown after battles
    const pendingEliminationTexts = new Map<number, PlayerEliminationEvent>();

    /**
     * Check if there's an active animation at a planet
     */
    function hasAnimationAtPlanet(
        planetId: number,
        animations: Map<string, BattleAnimationState>
    ): boolean {
        for (const anim of animations.values()) {
            if (anim.replay.planetId === planetId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get the display planet state (uses pre-battle state if animation is active)
     * This preserves suspense during battle animations
     */
    function getDisplayPlanet(
        planet: Planet,
        animations: Map<string, BattleAnimationState>
    ): Planet {
        // Check if there's an active battle animation for this planet
        for (const anim of animations.values()) {
            if (anim.replay.planetId === planet.id && anim.preBattlePlanetState) {
                // Once outcome is shown, reveal the actual battle result
                // Update when animation phase is 'outcome' or 'done'
                if (anim.phase === 'outcome' || anim.phase === 'done') {
                    // Show post-battle state (actual planet state from gameState)
                    return planet;
                }
                // Return planet with pre-battle state to preserve suspense during animation
                return {
                    ...planet,
                    ownerId: anim.preBattlePlanetState.ownerId,
                    ships: anim.preBattlePlanetState.ships,
                };
            }
        }
        // No active animation - always show actual planet state
        return planet;
    }

    /**
     * Process battle replays from game state
     * Should be called reactively when game state changes
     */
    function processReplays(currentGameState: GalacticGameStateData): void {
        const replays = currentGameState.recentBattleReplays ?? [];
        const currentReplayIds = extractReplayIds(replays);
        const hasNew = hasNewReplays(currentReplayIds, lastReplayIds);

        console.log(`[BattleCoordinator] Checking battle replays:`, {
            count: replays.length,
            planetNames: replays.map(r => r.planetName),
            replayIds: currentReplayIds,
            lastReplayIds: lastReplayIds,
            hasNewReplays: hasNew,
        });

        if (replays.length > 0 && hasNew) {
            console.log(`[BattleCoordinator] Processing ${replays.length} battle replays (${replays.length - lastReplayIds.length} new)`);
            processNewBattleReplays(replays);
            lastReplayIds = currentReplayIds;
        } else if (replays.length === 0 && lastReplayIds.length > 0) {
            console.log(`[BattleCoordinator] Battle replays cleared from state, but animations continue`);
            lastReplayIds = [];
        }
    }

    return {
        battleAnimations,
        hasAnimationAtPlanet,
        getDisplayPlanet,
        processReplays,
        pendingEliminationTexts
    };
}
