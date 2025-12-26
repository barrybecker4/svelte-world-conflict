import type {
    ReinforcementEvent,
    ConquestEvent,
    PlayerEliminationEvent,
    BattleReplay
} from '$lib/game/entities/gameTypes';

/**
 * Check if there are new replays that haven't been processed yet
 */
export function hasNewReplays(
    currentReplayIds: string[],
    lastReplayIds: string[]
): boolean {
    return currentReplayIds.some(id => !lastReplayIds.includes(id));
}

/**
 * Extract replay IDs from a list of battle replays
 */
export function extractReplayIds(replays: BattleReplay[]): string[] {
    return replays.map(r => r.id);
}

/**
 * Filter events that haven't been processed yet
 */
export function filterUnprocessedEvents<T extends { id: string }>(
    events: T[],
    processedIds: Set<string>
): T[] {
    return events.filter(event => !processedIds.has(event.id));
}

/**
 * Check if an event should be shown immediately or delayed
 */
export function shouldDelayEliminationEvent(
    event: PlayerEliminationEvent,
    activeAnimations: Map<string, any>,
    battleReplays: BattleReplay[] | undefined
): boolean {
    // Check if there's an active battle animation at this planet
    const hasActiveBattle = Array.from(activeAnimations.values()).some(
        a => a.replay.planetId === event.planetId
    );
    
    // Check if there's a battle replay at this planet
    const hasBattleReplay = battleReplays?.some(
        r => r.planetId === event.planetId
    ) ?? false;
    
    return hasActiveBattle || hasBattleReplay;
}

/**
 * Check if there's a conquest event at a given planet
 */
export function hasConquestEventAtPlanet(
    conquestEvents: ConquestEvent[] | undefined,
    planetId: number
): boolean {
    return conquestEvents?.some(e => e.planetId === planetId) ?? false;
}
