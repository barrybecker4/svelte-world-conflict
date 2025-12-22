/**
 * Utility functions for formatting game state values for logging
 */

import type { Player } from '$lib/game/entities/gameTypes';

export type EndResult = Player | 'DRAWN_GAME' | null | undefined;

/**
 * Format endResult for logging
 */
export function formatEndResult(result: EndResult): string {
    if (result === null || result === undefined) return 'null';
    if (result === 'DRAWN_GAME') return 'DRAWN_GAME';
    return `Player ${result.slotIndex} (${result.name})`;
}

