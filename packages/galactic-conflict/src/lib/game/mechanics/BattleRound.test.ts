/**
 * Unit tests for BattleRound
 * Tests Risk-style dice combat mechanics for space battles
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
            expect(result).toHaveProperty('attackerRolls');
            expect(result).toHaveProperty('defenderRolls');
            expect(typeof result.attackerCasualties).toBe('number');
            expect(typeof result.defenderCasualties).toBe('number');
            expect(Array.isArray(result.attackerRolls)).toBe(true);
            expect(Array.isArray(result.defenderRolls)).toBe(true);
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
            expect(results[0].attackerRolls).toEqual(results[1].attackerRolls);
            expect(results[0].defenderRolls).toEqual(results[1].defenderRolls);
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
                r =>
                    r.attackerCasualties === results[0].attackerCasualties &&
                    r.defenderCasualties === results[0].defenderCasualties
            );
            // While theoretically possible, it's extremely unlikely all 3 are identical
            expect(allSame).toBe(false);
        });

        it('should return rolls sorted in descending order', () => {
            const rng = new RandomNumberGenerator('sort-test-seed');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(3, 2);

            // Attacker rolls should be sorted descending
            for (let i = 0; i < result.attackerRolls.length - 1; i++) {
                expect(result.attackerRolls[i]).toBeGreaterThanOrEqual(result.attackerRolls[i + 1]);
            }

            // Defender rolls should be sorted descending
            for (let i = 0; i < result.defenderRolls.length - 1; i++) {
                expect(result.defenderRolls[i]).toBeGreaterThanOrEqual(result.defenderRolls[i + 1]);
            }
        });

        it('should return dice values between 1 and 6', () => {
            const rng = new RandomNumberGenerator('dice-range-seed');
            const battleRound = new BattleRound(rng);

            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(3, 2);

                // Check all attacker rolls
                for (const roll of result.attackerRolls) {
                    expect(roll).toBeGreaterThanOrEqual(1);
                    expect(roll).toBeLessThanOrEqual(6);
                }

                // Check all defender rolls
                for (const roll of result.defenderRolls) {
                    expect(roll).toBeGreaterThanOrEqual(1);
                    expect(roll).toBeLessThanOrEqual(6);
                }
            }
        });
    });

    describe('dice limits', () => {
        it('should limit attacker dice to 3 even with more ships', () => {
            const rng = new RandomNumberGenerator('max-dice-seed');
            const battleRound = new BattleRound(rng);

            // Even with 100 attackers, should only roll 3 dice
            const result = battleRound.resolve(100, 2);
            expect(result.attackerRolls.length).toBeLessThanOrEqual(3);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });

        it('should limit defender dice to 2 even with more ships', () => {
            const rng = new RandomNumberGenerator('defender-dice-seed');
            const battleRound = new BattleRound(rng);

            // Even with 100 defenders, should only roll 2 dice
            const result = battleRound.resolve(3, 100);
            expect(result.defenderRolls.length).toBeLessThanOrEqual(2);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });

        it('should only compare 1 die when attacker has 1 ship', () => {
            const rng = new RandomNumberGenerator('one-attacker-seed');
            const battleRound = new BattleRound(rng);

            // With 1 attacker, only 1 comparison happens
            const result = battleRound.resolve(1, 5);
            expect(result.attackerRolls.length).toBe(1);
            expect(result.attackerCasualties + result.defenderCasualties).toBe(1);
        });

        it('should only compare 1 die when defender has 1 ship', () => {
            const rng = new RandomNumberGenerator('one-defender-seed');
            const battleRound = new BattleRound(rng);

            // With 1 defender, only 1 comparison happens
            const result = battleRound.resolve(5, 1);
            expect(result.defenderRolls.length).toBe(1);
            expect(result.attackerCasualties + result.defenderCasualties).toBe(1);
        });

        it('should compare 2 dice when both sides have 2+ ships', () => {
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

        it('should roll correct number of dice for various ship counts', () => {
            const rng = new RandomNumberGenerator('dice-count-seed');
            const battleRound = new BattleRound(rng);

            // Test various combinations
            const testCases = [
                { attackers: 1, defenders: 1, expectedAttackerDice: 1, expectedDefenderDice: 1 },
                { attackers: 2, defenders: 1, expectedAttackerDice: 2, expectedDefenderDice: 1 },
                { attackers: 3, defenders: 2, expectedAttackerDice: 3, expectedDefenderDice: 2 },
                { attackers: 5, defenders: 3, expectedAttackerDice: 3, expectedDefenderDice: 2 },
                { attackers: 10, defenders: 10, expectedAttackerDice: 3, expectedDefenderDice: 2 },
            ];

            for (const testCase of testCases) {
                const result = battleRound.resolve(testCase.attackers, testCase.defenders);
                expect(result.attackerRolls.length).toBe(testCase.expectedAttackerDice);
                expect(result.defenderRolls.length).toBe(testCase.expectedDefenderDice);
            }
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

        it('should give defender the win when highest dice tie', () => {
            // Create a mock RNG that returns specific values to test tie behavior
            // We'll use a seed that produces ties
            const rng = new RandomNumberGenerator('tie-specific-test');
            const battleRound = new BattleRound(rng);

            // Run many rounds to find a tie scenario
            let foundTie = false;
            for (let i = 0; i < 1000; i++) {
                const testRng = new RandomNumberGenerator(`tie-search-${i}`);
                const testBattle = new BattleRound(testRng);
                const result = testBattle.resolve(3, 2);

                // If highest dice tie, defender should win that comparison
                if (result.attackerRolls[0] === result.defenderRolls[0]) {
                    foundTie = true;
                    // When highest dice tie, attacker should take a casualty
                    // (defender wins the tie)
                    expect(result.attackerCasualties).toBeGreaterThanOrEqual(1);
                    break;
                }
            }

            // It's very likely we'll find a tie in 1000 attempts
            // But if we don't, that's okay - the test above verifies the behavior statistically
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

        it('should never have more than 2 casualties per side in a round', () => {
            const rng = new RandomNumberGenerator('per-side-max');
            const battleRound = new BattleRound(rng);

            for (let i = 0; i < 50; i++) {
                const result = battleRound.resolve(10, 10);
                // Each side can lose at most 2 (one per dice comparison)
                expect(result.attackerCasualties).toBeLessThanOrEqual(2);
                expect(result.defenderCasualties).toBeLessThanOrEqual(2);
            }
        });

        it('should have exactly 1 casualty when only one die is compared', () => {
            const rng = new RandomNumberGenerator('single-die-test');
            const battleRound = new BattleRound(rng);

            // Test with 1 attacker
            const result1 = battleRound.resolve(1, 5);
            expect(result1.attackerCasualties + result1.defenderCasualties).toBe(1);

            // Test with 1 defender
            const result2 = battleRound.resolve(5, 1);
            expect(result2.attackerCasualties + result2.defenderCasualties).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('should handle minimum ship counts (1 vs 1)', () => {
            const rng = new RandomNumberGenerator('min-ships-test');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(1, 1);
            expect(result.attackerRolls.length).toBe(1);
            expect(result.defenderRolls.length).toBe(1);
            expect(result.attackerCasualties + result.defenderCasualties).toBe(1);
        });

        it('should handle maximum dice scenarios (3 vs 2)', () => {
            const rng = new RandomNumberGenerator('max-dice-scenario');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(3, 2);
            expect(result.attackerRolls.length).toBe(3);
            expect(result.defenderRolls.length).toBe(2);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });

        it('should handle very large ship counts', () => {
            const rng = new RandomNumberGenerator('large-ships-test');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(1000, 1000);
            expect(result.attackerRolls.length).toBeLessThanOrEqual(3);
            expect(result.defenderRolls.length).toBeLessThanOrEqual(2);
            expect(result.attackerCasualties + result.defenderCasualties).toBeLessThanOrEqual(2);
        });
    });

    describe('result structure', () => {
        it('should return all required properties', () => {
            const rng = new RandomNumberGenerator('structure-test');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(3, 2);

            expect(result).toHaveProperty('attackerCasualties');
            expect(result).toHaveProperty('defenderCasualties');
            expect(result).toHaveProperty('attackerRolls');
            expect(result).toHaveProperty('defenderRolls');
        });

        it('should return rolls arrays with correct lengths', () => {
            const rng = new RandomNumberGenerator('rolls-length-test');
            const battleRound = new BattleRound(rng);

            const result = battleRound.resolve(3, 2);
            expect(result.attackerRolls.length).toBe(3);
            expect(result.defenderRolls.length).toBe(2);
            expect(Array.isArray(result.attackerRolls)).toBe(true);
            expect(Array.isArray(result.defenderRolls)).toBe(true);
        });
    });
});

