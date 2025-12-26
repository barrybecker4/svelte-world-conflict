/**
 * Statistics Helper Functions
 * Utilities for handling stats data, including Infinity handling for minDurationMinutes
 */

import type { DailyGameStats } from './types';

/**
 * Convert Infinity to null for JSON serialization
 * JSON doesn't support Infinity, so we store it as null
 */
export function serializeMinDuration(minDuration: number): number | null {
    return minDuration === Infinity ? null : minDuration;
}

/**
 * Convert null to Infinity for deserialization
 * Handles legacy data where minDurationMinutes might be null
 */
export function deserializeMinDuration(minDuration: number | null | undefined): number {
    if (minDuration === null || minDuration === undefined) {
        return Infinity;
    }
    return minDuration;
}

/**
 * Normalize stats by ensuring minDurationMinutes is properly handled
 * Used when loading stats from storage
 */
export function normalizeStats(stats: DailyGameStats): DailyGameStats {
    return {
        ...stats,
        minDurationMinutes: deserializeMinDuration(stats.minDurationMinutes)
    };
}

/**
 * Prepare stats for storage by converting Infinity to null
 */
export function prepareStatsForStorage(stats: DailyGameStats): DailyGameStats & { minDurationMinutes: number | null } {
    return {
        ...stats,
        minDurationMinutes: serializeMinDuration(stats.minDurationMinutes)
    };
}
