/**
 * Array utility functions for game logic
 */
import type { RandomNumberGenerator } from 'multiplayer-framework/shared';

/**
 * Fisher-Yates shuffle algorithm with seeded RNG for deterministic behavior
 */
export function shuffleWithRng<T>(array: T[], rng: RandomNumberGenerator): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = rng.nextIntExclusive(0, i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Sum all numbers in an array
 */
export function sum(array: number[]): number {
    return array.reduce((total, val) => total + val, 0);
}

/**
 * Sum values by applying a mapper function
 */
export function sumBy<T>(array: T[], mapper: (item: T) => number): number {
    return array.reduce((total, item) => total + mapper(item), 0);
}

/**
 * Find the maximum value in an array
 */
export function max(array: number[]): number {
    if (array.length === 0) return -Infinity;
    return Math.max(...array);
}

/**
 * Find the element with the maximum mapped value
 */
export function maxBy<T>(array: T[], mapper: (item: T) => number): T | undefined {
    if (array.length === 0) return undefined;

    let maxItem = array[0];
    let maxValue = mapper(maxItem);

    for (let i = 1; i < array.length; i++) {
        const value = mapper(array[i]);
        if (value > maxValue) {
            maxValue = value;
            maxItem = array[i];
        }
    }

    return maxItem;
}

/**
 * Find the minimum value in an array
 */
export function min(array: number[]): number {
    if (array.length === 0) return Infinity;
    return Math.min(...array);
}

/**
 * Find the element with the minimum mapped value
 */
export function minBy<T>(array: T[], mapper: (item: T) => number): T | undefined {
    if (array.length === 0) return undefined;

    let minItem = array[0];
    let minValue = mapper(minItem);

    for (let i = 1; i < array.length; i++) {
        const value = mapper(array[i]);
        if (value < minValue) {
            minValue = value;
            minItem = array[i];
        }
    }

    return minItem;
}

/**
 * Check if an array contains a specific item
 */
export function contains<T>(array: T[], item: T): boolean {
    return array.includes(item);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
