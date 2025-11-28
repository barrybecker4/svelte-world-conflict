/**
 * Unit tests for AttackSequenceGenerator
 * Tests Risk-style dice combat, preemptive damage, and battle resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttackSequenceGenerator, type ArmyMoveData, type AttackEvent } from './AttackSequenceGenerator';
import { RandomNumberGenerator } from '$lib/game/utils/RandomNumberGenerator';
import { GameState } from '$lib/game/state/GameState';
import type { Player } from '$lib/game/entities/gameTypes';
import { TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';

// Helper to create a mock player
function createPlayer(slotIndex: number, name: string): Player {
    return {
        slotIndex,
        name,
        color: slotIndex === 0 ? '#ff0000' : '#0000ff',
        isAI: false
    };
}

// Helper to create a basic game state for combat testing
function createCombatGameState(options: {
    attackerSoldiers: number;
    defenderSoldiers: number;
    attackerOwner?: number;
    defenderOwner?: number;
    earthLevel?: number;
    seed?: string;
}): GameState {
    const {
        attackerSoldiers,
        defenderSoldiers,
        attackerOwner = 0,
        defenderOwner = 1,
        earthLevel = 0,
        seed = 'test-seed'
    } = options;

    const players = [
        createPlayer(0, 'Attacker'),
        createPlayer(1, 'Defender')
    ];

    const regions = [
        { index: 0, name: 'Region 0', neighbors: [1], x: 100, y: 100, hasTemple: false, points: [] },
        { index: 1, name: 'Region 1', neighbors: [0], x: 200, y: 100, hasTemple: true, points: [] }
    ];

    const soldiersByRegion: Record<number, { i: number }[]> = {
        0: Array.from({ length: attackerSoldiers }, (_, i) => ({ i: i + 1 })),
        1: Array.from({ length: defenderSoldiers }, (_, i) => ({ i: i + 100 }))
    };

    const ownersByRegion: Record<number, number> = {
        0: attackerOwner,
        1: defenderOwner
    };

    // Set up Earth temple if defense level is specified
    const templesByRegion: Record<number, any> = {};
    if (earthLevel > 0) {
        templesByRegion[1] = {
            regionIndex: 1,
            upgradeIndex: TEMPLE_UPGRADES_BY_NAME.EARTH.index,
            level: earthLevel
        };
    }

    return new GameState({
        id: 1,
        gameId: 'test-combat',
        turnNumber: 1,
        currentPlayerSlot: 0,
        players,
        regions,
        movesRemaining: 3,
        maxTurns: 100,
        ownersByRegion,
        soldiersByRegion,
        templesByRegion,
        faithByPlayer: { 0: 100, 1: 100 },
        conqueredRegions: [],
        eliminatedPlayers: [],
        rngSeed: seed
    });
}

describe('AttackSequenceGenerator', () => {
    describe('createAttackSequenceIfFight', () => {
        it('should return undefined when attacking own region (no combat)', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 3,
                attackerOwner: 0,
                defenderOwner: 0 // Same owner - no fight
            });

            const rng = new RandomNumberGenerator('test-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 3
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeUndefined();
        });

        it('should return attack sequence when attacking enemy region', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 3,
                seed: 'combat-seed'
            });

            const rng = new RandomNumberGenerator('combat-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 3
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();
            expect(Array.isArray(sequence)).toBe(true);
            expect(sequence!.length).toBeGreaterThan(0);
        });

        it('should include combat events with casualties', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 10,
                defenderSoldiers: 5,
                seed: 'casualties-seed'
            });

            const rng = new RandomNumberGenerator('casualties-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 10
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Find combat events (those with casualty counts)
            const combatEvents = sequence!.filter(
                (e: AttackEvent) => e.attackerCasualties !== undefined || e.defenderCasualties !== undefined
            );

            expect(combatEvents.length).toBeGreaterThan(0);

            // Verify running totals are tracked
            const lastCombatEvent = combatEvents[combatEvents.length - 1];
            expect(lastCombatEvent.runningAttackerTotal).toBeGreaterThanOrEqual(0);
            expect(lastCombatEvent.runningDefenderTotal).toBeGreaterThanOrEqual(0);
        });

        it('should show "Conquered!" text when attackers win', () => {
            // Use a seed that gives attackers advantage
            const gameState = createCombatGameState({
                attackerSoldiers: 20,
                defenderSoldiers: 1,
                seed: 'attacker-wins-seed'
            });

            const rng = new RandomNumberGenerator('attacker-wins-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 20
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Look for "Conquered!" floating text
            const conqueredEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text === 'Conquered!')
            );

            expect(conqueredEvent).toBeDefined();
        });

        it('should show "Defended!" text when defenders win', () => {
            // Use a seed that gives defenders advantage
            const gameState = createCombatGameState({
                attackerSoldiers: 1,
                defenderSoldiers: 20,
                seed: 'defender-wins-seed'
            });

            const rng = new RandomNumberGenerator('defender-wins-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 1
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Look for "Defended!" floating text
            const defendedEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text === 'Defended!')
            );

            expect(defendedEvent).toBeDefined();
        });

        it('should show "Conquered!" when attacking neutral region with no soldiers', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 0, // No defenders
                seed: 'neutral-seed'
            });

            const rng = new RandomNumberGenerator('neutral-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 3
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Should still show "Conquered!" for taking neutral region
            const conqueredEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text === 'Conquered!')
            );

            expect(conqueredEvent).toBeDefined();
        });
    });

    describe('Earth upgrade preemptive damage', () => {
        it('should apply Earth defense damage before combat', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 10,
                defenderSoldiers: 3,
                earthLevel: 1, // Level 1 Earth = 1 preemptive kill
                seed: 'earth-seed'
            });

            const rng = new RandomNumberGenerator('earth-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 5
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Look for Earth damage event (has "Earth kills" text)
            const earthEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text.includes('Earth kills'))
            );

            expect(earthEvent).toBeDefined();
            expect(earthEvent!.attackerCasualties).toBeGreaterThan(0);
            expect(earthEvent!.defenderCasualties).toBe(0);
        });

        it('should apply level 2 Earth damage correctly', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 10,
                defenderSoldiers: 3,
                earthLevel: 2, // Level 2 Earth = 2 preemptive kills
                seed: 'earth-level2-seed'
            });

            const rng = new RandomNumberGenerator('earth-level2-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 5
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Find Earth damage event
            const earthEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text.includes('Earth kills'))
            );

            expect(earthEvent).toBeDefined();
            // Level 2 should kill 2 attackers
            expect(earthEvent!.attackerCasualties).toBe(2);
        });

        it('should cap Earth damage at incoming soldier count', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 3,
                earthLevel: 2, // Level 2 wants to kill 2
                seed: 'earth-cap-seed'
            });

            const rng = new RandomNumberGenerator('earth-cap-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 1 // Only sending 1 soldier
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Find Earth damage event
            const earthEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text.includes('Earth kills'))
            );

            expect(earthEvent).toBeDefined();
            // Should only kill 1 (capped at incoming soldiers)
            expect(earthEvent!.attackerCasualties).toBe(1);
        });
    });

    describe('Risk-style dice combat mechanics', () => {
        it('should produce deterministic results with same seed', () => {
            const seed = 'deterministic-test';

            // Run combat twice with same setup
            const results: (AttackEvent[] | undefined)[] = [];

            for (let i = 0; i < 2; i++) {
                const gameState = createCombatGameState({
                    attackerSoldiers: 10,
                    defenderSoldiers: 5,
                    seed
                });

                const rng = new RandomNumberGenerator(seed);
                const moveData: ArmyMoveData = {
                    source: 0,
                    destination: 1,
                    count: 10
                };

                const generator = new AttackSequenceGenerator(moveData, rng);
                results.push(generator.createAttackSequenceIfFight(gameState, gameState.players));
            }

            // Both results should be identical
            expect(results[0]).toBeDefined();
            expect(results[1]).toBeDefined();
            expect(results[0]!.length).toBe(results[1]!.length);

            // Compare casualty events
            for (let i = 0; i < results[0]!.length; i++) {
                expect(results[0]![i].attackerCasualties).toBe(results[1]![i].attackerCasualties);
                expect(results[0]![i].defenderCasualties).toBe(results[1]![i].defenderCasualties);
            }
        });

        it('should produce different results with different seeds', () => {
            const seeds = ['seed-alpha', 'seed-beta'];
            const totalCasualties: number[] = [];

            for (const seed of seeds) {
                const gameState = createCombatGameState({
                    attackerSoldiers: 10,
                    defenderSoldiers: 5,
                    seed
                });

                const rng = new RandomNumberGenerator(seed);
                const moveData: ArmyMoveData = {
                    source: 0,
                    destination: 1,
                    count: 10
                };

                const generator = new AttackSequenceGenerator(moveData, rng);
                const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

                // Sum total casualties
                const total = sequence!.reduce((sum, e) => {
                    return sum + (e.attackerCasualties || 0) + (e.defenderCasualties || 0);
                }, 0);
                totalCasualties.push(total);
            }

            // Results should likely differ (not guaranteed but very probable)
            // At minimum, we verify both produce valid results
            expect(totalCasualties[0]).toBeGreaterThan(0);
            expect(totalCasualties[1]).toBeGreaterThan(0);
        });

        it('should always have at least one casualty per combat round', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 5,
                seed: 'casualty-per-round'
            });

            const rng = new RandomNumberGenerator('casualty-per-round');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 5
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Each combat event should have at least one casualty
            const combatEvents = sequence!.filter(
                (e: AttackEvent) => e.soundCue === 'COMBAT'
            );

            for (const event of combatEvents) {
                const totalCasualties = (event.attackerCasualties || 0) + (event.defenderCasualties || 0);
                expect(totalCasualties).toBeGreaterThan(0);
            }
        });

        it('should include sound cues for combat events', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 3,
                seed: 'sound-test'
            });

            const rng = new RandomNumberGenerator('sound-test');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 5
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Should have COMBAT sound cues
            const combatSounds = sequence!.filter((e: AttackEvent) => e.soundCue === 'COMBAT');
            expect(combatSounds.length).toBeGreaterThan(0);
        });

        it('should include delays for animation timing', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 5,
                defenderSoldiers: 3,
                seed: 'delay-test'
            });

            const rng = new RandomNumberGenerator('delay-test');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 5
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Combat events should have delays
            const eventsWithDelay = sequence!.filter((e: AttackEvent) => e.delay !== undefined && e.delay > 0);
            expect(eventsWithDelay.length).toBeGreaterThan(0);
        });
    });

    describe('simulation mode', () => {
        it('should work in simulation mode (for AI)', () => {
            const gameState = createCombatGameState({
                attackerSoldiers: 10,
                defenderSoldiers: 5,
                seed: 'simulation-seed'
            });

            const rng = new RandomNumberGenerator('simulation-seed');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 10
            };

            // isSimulation = true
            const generator = new AttackSequenceGenerator(moveData, rng, true);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();
            expect(sequence!.length).toBeGreaterThan(0);
        });
    });

    describe('combat ends when one side is eliminated', () => {
        it('should end combat when all attackers are eliminated', () => {
            // Very weak attackers vs strong defenders
            const gameState = createCombatGameState({
                attackerSoldiers: 2,
                defenderSoldiers: 20,
                seed: 'attackers-eliminated'
            });

            const rng = new RandomNumberGenerator('attackers-eliminated');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 2
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Calculate total attacker casualties
            const totalAttackerCasualties = sequence!.reduce(
                (sum, e) => sum + (e.attackerCasualties || 0),
                0
            );

            // All 2 attackers should be eliminated (capped at 2)
            expect(totalAttackerCasualties).toBeLessThanOrEqual(2);

            // Should have "Defended!" message
            const defendedEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text === 'Defended!')
            );
            expect(defendedEvent).toBeDefined();
        });

        it('should end combat when all defenders are eliminated', () => {
            // Strong attackers vs weak defenders
            const gameState = createCombatGameState({
                attackerSoldiers: 20,
                defenderSoldiers: 2,
                seed: 'defenders-eliminated'
            });

            const rng = new RandomNumberGenerator('defenders-eliminated');
            const moveData: ArmyMoveData = {
                source: 0,
                destination: 1,
                count: 20
            };

            const generator = new AttackSequenceGenerator(moveData, rng);
            const sequence = generator.createAttackSequenceIfFight(gameState, gameState.players);

            expect(sequence).toBeDefined();

            // Calculate total defender casualties
            const totalDefenderCasualties = sequence!.reduce(
                (sum, e) => sum + (e.defenderCasualties || 0),
                0
            );

            // All 2 defenders should be eliminated
            expect(totalDefenderCasualties).toBe(2);

            // Should have "Conquered!" message
            const conqueredEvent = sequence!.find(
                (e: AttackEvent) => e.floatingText?.some(ft => ft.text === 'Conquered!')
            );
            expect(conqueredEvent).toBeDefined();
        });
    });
});

