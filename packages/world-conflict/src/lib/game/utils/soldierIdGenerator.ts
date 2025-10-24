/**
 * Soldier ID Generator
 * Simple incrementing counter - guaranteed unique, no collisions possible
 */

let nextSoldierId = 1;

/**
 * Generate a unique soldier ID
 * Uses a simple incrementing counter for guaranteed uniqueness
 * 
 * @returns Unique soldier ID
 */
export function generateSoldierId(): number {
    return nextSoldierId++;
}

/**
 * Reset the ID generator (mainly for testing)
 */
export function resetSoldierIdGenerator(): void {
    nextSoldierId = 1;
}

