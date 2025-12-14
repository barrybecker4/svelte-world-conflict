/**
 * Utility for cleaning up old game entries from KV storage
 */
import { KVStorage } from './KVStorage';
import { logger } from 'multiplayer-framework/shared';

const GAME_KEY_PREFIX = 'wc_game:';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extract timestamp from a game ID
 * Game ID format: wc_<timestamp>_<random>
 * Example: wc_1753631245806_16g3wob8b
 */
function extractTimestampFromGameId(gameId: string): number | null {
    // Remove the wc_ prefix and extract the timestamp part
    const match = gameId.match(/^wc_(\d+)_/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Extract game ID from a KV key
 * Key format: wc_game:wc_<timestamp>_<random>
 */
function extractGameIdFromKey(key: string): string | null {
    if (key.startsWith(GAME_KEY_PREFIX)) {
        return key.slice(GAME_KEY_PREFIX.length);
    }
    return null;
}

export interface CleanupResult {
    scanned: number;
    deleted: number;
    errors: number;
    deletedKeys: string[];
    errorDetails: string[];
}

/**
 * Clean up old game entries from KV storage
 * 
 * @param platform - The platform context with KV bindings
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 day)
 * @param dryRun - If true, only report what would be deleted without actually deleting
 * @returns Cleanup result with counts and details
 */
export async function cleanupOldGames(
    platform: App.Platform,
    maxAgeMs: number = ONE_DAY_MS,
    dryRun: boolean = false
): Promise<CleanupResult> {
    const kv = new KVStorage(platform);
    const now = Date.now();
    const cutoffTime = now - maxAgeMs;
    
    const result: CleanupResult = {
        scanned: 0,
        deleted: 0,
        errors: 0,
        deletedKeys: [],
        errorDetails: []
    };

    try {
        // List all game keys
        const listResult = await kv.list(GAME_KEY_PREFIX);
        const keys = listResult.keys;
        
        logger.info(`Found ${keys.length} game entries to scan`);
        result.scanned = keys.length;

        for (const keyObj of keys) {
            const key = keyObj.name;
            const gameId = extractGameIdFromKey(key);
            
            if (!gameId) {
                continue;
            }

            const timestamp = extractTimestampFromGameId(gameId);
            
            if (timestamp === null) {
                // Can't determine age, skip
                logger.debug(`Skipping ${key}: could not extract timestamp`);
                continue;
            }

            if (timestamp < cutoffTime) {
                // This game is older than the cutoff
                if (dryRun) {
                    logger.info(`[DRY RUN] Would delete: ${key} (age: ${formatAge(now - timestamp)})`);
                    result.deletedKeys.push(key);
                    result.deleted++;
                } else {
                    try {
                        await kv.delete(key);
                        logger.info(`Deleted: ${key} (age: ${formatAge(now - timestamp)})`);
                        result.deletedKeys.push(key);
                        result.deleted++;
                    } catch (error) {
                        const errorMsg = `Failed to delete ${key}: ${error}`;
                        logger.error(errorMsg);
                        result.errors++;
                        result.errorDetails.push(errorMsg);
                    }
                }
            }
        }

        logger.info(`Cleanup complete: scanned ${result.scanned}, deleted ${result.deleted}, errors ${result.errors}`);
        
    } catch (error) {
        const errorMsg = `Cleanup failed: ${error}`;
        logger.error(errorMsg);
        result.errors++;
        result.errorDetails.push(errorMsg);
    }

    return result;
}

/**
 * Format age in human-readable format
 */
function formatAge(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''}, ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

/**
 * Get statistics about game entries without deleting
 */
export async function getGameStats(platform: App.Platform): Promise<{
    total: number;
    byAge: { label: string; count: number }[];
}> {
    const kv = new KVStorage(platform);
    const now = Date.now();
    
    const stats = {
        total: 0,
        byAge: [
            { label: 'Less than 1 hour', count: 0 },
            { label: '1-6 hours', count: 0 },
            { label: '6-24 hours', count: 0 },
            { label: '1-7 days', count: 0 },
            { label: 'More than 7 days', count: 0 },
            { label: 'Unknown age', count: 0 }
        ]
    };

    try {
        const listResult = await kv.list(GAME_KEY_PREFIX);
        stats.total = listResult.keys.length;

        for (const keyObj of listResult.keys) {
            const gameId = extractGameIdFromKey(keyObj.name);
            if (!gameId) continue;

            const timestamp = extractTimestampFromGameId(gameId);
            if (timestamp === null) {
                stats.byAge[5].count++; // Unknown age
                continue;
            }

            const ageMs = now - timestamp;
            const ageHours = ageMs / (1000 * 60 * 60);

            if (ageHours < 1) {
                stats.byAge[0].count++;
            } else if (ageHours < 6) {
                stats.byAge[1].count++;
            } else if (ageHours < 24) {
                stats.byAge[2].count++;
            } else if (ageHours < 24 * 7) {
                stats.byAge[3].count++;
            } else {
                stats.byAge[4].count++;
            }
        }
    } catch (error) {
        logger.error('Failed to get game stats:', error);
    }

    return stats;
}

