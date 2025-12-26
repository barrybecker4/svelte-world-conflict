/**
 * Seeded Random Number Generator for deterministic gameplay
 * Uses seedrandom library for high-quality, reproducible random number generation
 * 
 * This ensures that games with the same seed will produce identical
 * random outcomes, which is essential for reproducible testing.
 */

import seedrandom from 'seedrandom';

export interface RNGState {
    seed: string;
    state: unknown; // seedrandom state object
}

// Extend the PRNG type to include state method
interface PRNGWithState extends seedrandom.PRNG {
    state(): unknown;
}

export class RandomNumberGenerator {
    private prng: PRNGWithState;
    private readonly originalSeed: string;

    /**
     * Create a new RNG with the given seed
     * @param seed - String seed for the RNG
     * @param serializedState - Optional serialized state for restoring from saved state
     */
    constructor(seed: string, serializedState?: unknown) {
        this.originalSeed = seed;
        
        if (serializedState) {
            // Restore from serialized state - cast to any since seedrandom accepts the serialized state object
            this.prng = seedrandom(seed, { state: serializedState as any }) as PRNGWithState;
        } else {
            // Create new PRNG with state tracking enabled
            this.prng = seedrandom(seed, { state: true }) as PRNGWithState;
        }
    }

    /**
     * Generate next random number in range [0, 1)
     */
    next(): number {
        return this.prng();
    }

    /**
     * Generate random integer in range [min, max] (inclusive)
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /**
     * Generate random integer in range [min, max) (exclusive max)
     */
    nextIntExclusive(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min;
    }

    /**
     * Roll a dice with given number of sides (1 to sides)
     */
    rollDice(sides: number): number {
        return this.nextInt(1, sides);
    }

    /**
     * Return true with given probability (0-1)
     */
    chance(probability: number): boolean {
        return this.next() < probability;
    }

    /**
     * Shuffle an array in place using Fisher-Yates algorithm
     */
    shuffle<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.nextIntExclusive(0, i + 1);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Pick a random element from an array
     */
    pick<T>(array: T[]): T {
        return array[this.nextIntExclusive(0, array.length)];
    }

    /**
     * Get current state for serialization
     */
    getState(): RNGState {
        return {
            seed: this.originalSeed,
            state: this.prng.state()
        };
    }

    /**
     * Create RNG from serialized state
     */
    static fromState(rngState: RNGState): RandomNumberGenerator {
        return new RandomNumberGenerator(rngState.seed, rngState.state);
    }

    /**
     * Create a copy of this RNG with the same state
     */
    copy(): RandomNumberGenerator {
        return new RandomNumberGenerator(this.originalSeed, this.prng.state());
    }
}
