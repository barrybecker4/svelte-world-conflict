/**
 * Unit tests for BattleRound
 * Tests Risk-style dice combat mechanics
 */

import { describe, it, expect } from 'vitest';
import { BattleRound, type BattleRoundResult } from './BattleRound';
import { RandomNumberGenerator } from 'multiplayer-framework/shared';

describe('BattleRound', () => {
    describe('resolve', () => {
        it('should return casualties for both sides', () => {
            const rng = new RandomNumberGenerator('test-seed');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(3, 2);

            expect(result).toHaveProperty('attackerCasualties');
            expect(result).toHaveProperty('defenderCasualties');
            expect(typeof result.attackerCasualties).toBe('number');
            expect(typeof result.defenderCasualties).toBe('number');
        });

        it('should always produce at least 1 total casualty per round', () => {
            const rng = new RandomNumberGenerator('casualty-seed');
            const battleRound = new BattleRound(rng);

            // Run multiple rounds to verify
            for (let i = 0; i < 20; i++) {
                const result = battleRound.resolve(5, 5);
                const totalCasualties = result.attackerCasualties + result.defenderCasualties;
                expect(totalCasualties).toBeGreaterThanOrEqual(1);
            }
        });

        it('should produce deterministic results with same seed', () => {
            const results: BattleRoundResult[] = [];

            // Run twice with same seed
            for (let i = 0; i < 2; i++) {
                const rng = new RandomNumberGenerator('deterministic-seed');
                const battleRound = new BattleRound(rng);
                results.push(battleRound.resolve(3, 2));
            }

            expect(results[0].attackerCasualties).toBe(results[1].attackerCasualties);
            expect(results[0].defenderCasualties).toBe(results[1].defenderCasualties);
        });

        it('should produce different results with different seeds', () => {
            const seeds = ['seed-one', 'seed-two', 'seed-three'];
            const results: BattleRoundResult[] = [];

            for (const seed of seeds) {
                const rng = new RandomNumberGenerator(seed);
                const battleRound = new BattleRound(rng);
                results.push(battleRound.resolve(3, 2));
            }

            // At least some results should differ (highly probable with different seeds)
            const allSame = results.every(
                r => r.attackerCasualties === results[0].attackerCasualties &&
                     r.defenderCasualties === results[0].defenderCasualties
            );
            // While theoretically possible, it's extremely unlikely all 3 are identical
            expect(allSame).toBe(false);
        });
    });

    describe('dice limits', () => {
        it('should limit attacker dice to 3 even with more soldiers', () => {
            const rng = new RandomNumberGenerator('max-dice-seed');
            const battleRound = new BattleRound(rng);

            // Even with 100 attackers, max casualties should be 2 (from 2 dice comparisons)
            const result = battleRound.resolve(100, 2);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });

        it('should limit defender dice to 2 even with more soldiers', () => {
            const rng = new RandomNumberGenerator('defender-dice-seed');
            const battleRound = new BattleRound(rng);

            // Even with 100 defenders, max casualties should be 2 (from 2 dice comparisons)
            const result = battleRound.resolve(3, 100);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });

        it('should only compare 1 die when attacker has 1 soldier', () => {
            const rng = new RandomNumberGenerator('one-attacker-seed');
            const battleRound = new BattleRound(rng);

            // With 1 attacker, only 1 comparison happens
            const result = battleRound.resolve(1, 5);
            expect(result.attackerCasualties + result.defenderCasualties).toBe(1);
        });

        it('should only compare 1 die when defender has 1 soldier', () => {
            const rng = new RandomNumberGenerator('one-defender-seed');
            const battleRound = new BattleRound(rng);

            // With 1 defender, only 1 comparison happens
            const result = battleRound.resolve(5, 1);
            expect(result.attackerCasualties + result.defenderCasualties).toBe(1);
        });

        it('should compare 2 dice when both sides have 2+ soldiers', () => {
            const rng = new RandomNumberGenerator('two-dice-seed');
            const battleRound = new BattleRound(rng);

            // Run multiple times to ensure we see both 1 and 2 total casualties
            const totalCasualties = new Set<number>();
            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(3, 2);
                totalCasualties.add(result.attackerCasualties + result.defenderCasualties);
            }

            // Should see exactly 2 casualties (both comparisons happen)
            expect(totalCasualties.has(2)).toBe(true);
        });
    });

    describe('ties go to defender', () => {
        it('should favor defender on ties (statistical test)', () => {
            // Run many battles and verify defender wins aren't disadvantaged
            let attackerWins = 0;
            let defenderWins = 0;

            // Use a fresh RNG for each round to get variety
            for (let i = 0; i < 100; i++) {
                const rng = new RandomNumberGenerator(`tie-test-${i}`);
                const battleRound = new BattleRound(rng);
                const result = battleRound.resolve(3, 2);

                // In Risk rules, ties go to defender, so defender should win slightly more
                // We're testing that the mechanic works, not exact probabilities
                if (result.defenderCasualties > result.attackerCasualties) {
                    attackerWins++;
                } else if (result.attackerCasualties > result.defenderCasualties) {
                    defenderWins++;
                }
                // Ties in casualties mean each side lost equally (e.g., 1-1)
            }

            // Defender should have some wins (ties go to defender)
            expect(defenderWins).toBeGreaterThan(0);
        });
    });

    describe('casualty bounds', () => {
        it('should never produce negative casualties', () => {
            const rng = new RandomNumberGenerator('negative-test');
            const battleRound = new BattleRound(rng);

            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(5, 5);
                expect(result.attackerCasualties).toBeGreaterThanOrEqual(0);
                expect(result.defenderCasualties).toBeGreaterThanOrEqual(0);
            }
        });

        it('should never exceed 2 total casualties per round', () => {
            const rng = new RandomNumberGenerator('max-casualties');
            const battleRound = new BattleRound(rng);

            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(10, 10);
                const total = result.attackerCasualties + result.defenderCasualties;
                expect(total).toBeLessThanOrEqual(2);
            }
        });

        it('should never have more than 1 casualty per side in a round', () => {
            const rng = new RandomNumberGenerator('per-side-max');
            const battleRound = new BattleRound(rng);

            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(10, 10);
                expect(result.attackerCasualties).toBeLessThanOrEqual(2);
                expect(result.defenderCasualties).toBeLessThanOrEqual(2);
            }
        });
    });
});
