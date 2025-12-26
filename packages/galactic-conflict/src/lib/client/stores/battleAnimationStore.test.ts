/**
 * Unit tests for battleAnimationStore
 * Tests battle replay animation functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { BattleReplay, BattleReplayRound } from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';

// Create mock function using vi.hoisted so it's available in the mock factory
const { mockPlaySound } = vi.hoisted(() => ({
    mockPlaySound: vi.fn(),
}));

// Mock audio system
vi.mock('$lib/client/audio', () => ({
    audioSystem: {
        playSound: mockPlaySound,
    },
    SOUNDS: {
        BATTLE_ALARM: 'BATTLE_ALARM',
        SHIP_DESTROYED: 'SHIP_DESTROYED',
        PLANET_CONQUERED: 'PLANET_CONQUERED',
    },
}));

// Import after mock is set up
import {
    battleAnimations,
    queueBattleReplay,
    removeBattleAnimation,
    clearAllBattleAnimations,
    processNewBattleReplays,
} from './battleAnimationStore';

/**
 * Helper to create a mock battle replay
 */
function createMockBattleReplay(overrides?: Partial<BattleReplay>): BattleReplay {
    return {
        id: 'replay-1',
        planetId: 1,
        planetName: 'Test Planet',
        attackerPlayerId: 0,
        attackerName: 'Attacker',
        attackerColor: '#ff0000',
        attackerInitialShips: 5,
        defenderPlayerId: 1,
        defenderName: 'Defender',
        defenderColor: '#0000ff',
        defenderInitialShips: 3,
        rounds: [
            {
                roundNumber: 1,
                attackerDice: [6, 5, 4],
                defenderDice: [3, 2],
                attackerLosses: 0,
                defenderLosses: 2,
                attackerShipsAfter: 5,
                defenderShipsAfter: 1,
            },
        ],
        winnerId: 0,
        winnerShipsRemaining: 5,
        timestamp: Date.now(),
        ...overrides,
    };
}

describe('battleAnimationStore', () => {
    beforeEach(() => {
        // Clear all animations before each test
        clearAllBattleAnimations();
        mockPlaySound.mockClear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('queueBattleReplay', () => {
        it('should queue a new battle replay and initialize state', () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);

            const animations = get(battleAnimations);
            expect(animations.has(replay.id)).toBe(true);

            const state = animations.get(replay.id);
            expect(state).toBeDefined();
            expect(state?.replay).toEqual(replay);
            expect(state?.currentRoundIndex).toBe(-1);
            expect(state?.displayedAttackerShips).toBe(5);
            expect(state?.displayedDefenderShips).toBe(3);
            expect(state?.currentDiceRolls).toBeNull();
            expect(state?.lastRoundResult).toBeNull();
            expect(state?.phase).toBe('starting');
            expect(state?.outcomeMessage).toBeNull();
            expect(state?.preBattlePlanetState).toEqual({
                ownerId: 1,
                ships: 3,
            });
        });

        it('should not queue the same replay twice', () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);
            queueBattleReplay(replay);

            const animations = get(battleAnimations);
            expect(animations.size).toBe(1);
        });

        it('should handle neutral planet defender (defenderPlayerId = -1)', () => {
            const replay = createMockBattleReplay({
                defenderPlayerId: -1,
                defenderName: 'Neutral',
            });

            queueBattleReplay(replay);

            const animations = get(battleAnimations);
            const state = animations.get(replay.id);
            expect(state?.preBattlePlanetState?.ownerId).toBeNull();
        });

        it('should start animation sequence when replay is queued', async () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);

            // Fast-forward through initial delay
            await vi.advanceTimersByTimeAsync(600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Should have played battle alarm
            expect(mockPlaySound).toHaveBeenCalledWith('BATTLE_ALARM');
        });
    });

    describe('removeBattleAnimation', () => {
        it('should remove a battle animation from the store', () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);
            expect(get(battleAnimations).has(replay.id)).toBe(true);

            removeBattleAnimation(replay.id);
            expect(get(battleAnimations).has(replay.id)).toBe(false);
        });

        it('should handle removing non-existent animation gracefully', () => {
            expect(() => removeBattleAnimation('non-existent')).not.toThrow();
        });
    });

    describe('clearAllBattleAnimations', () => {
        it('should clear all battle animations', () => {
            const replay1 = createMockBattleReplay({ id: 'replay-1' });
            const replay2 = createMockBattleReplay({ id: 'replay-2' });

            queueBattleReplay(replay1);
            queueBattleReplay(replay2);

            expect(get(battleAnimations).size).toBe(2);

            clearAllBattleAnimations();

            expect(get(battleAnimations).size).toBe(0);
        });

        it('should reset processed replay IDs', () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);
            clearAllBattleAnimations();

            // Should be able to queue the same replay again after clearing
            queueBattleReplay(replay);
            expect(get(battleAnimations).has(replay.id)).toBe(true);
        });
    });

    describe('processNewBattleReplays', () => {
        it('should queue multiple new replays', () => {
            const replay1 = createMockBattleReplay({ id: 'replay-1' });
            const replay2 = createMockBattleReplay({ id: 'replay-2' });

            processNewBattleReplays([replay1, replay2]);

            const animations = get(battleAnimations);
            expect(animations.has('replay-1')).toBe(true);
            expect(animations.has('replay-2')).toBe(true);
        });

        it('should skip already processed replays', () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);
            processNewBattleReplays([replay]);

            // Should still only have one animation
            expect(get(battleAnimations).size).toBe(1);
        });

        it('should handle empty array', () => {
            expect(() => processNewBattleReplays([])).not.toThrow();
            expect(get(battleAnimations).size).toBe(0);
        });
    });

    describe('battle animation sequence', () => {
        it('should progress through animation phases', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [6, 5],
                        defenderDice: [4, 3],
                        attackerLosses: 0,
                        defenderLosses: 1,
                        attackerShipsAfter: 5,
                        defenderShipsAfter: 2,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Initial state should be 'starting'
            let state = get(battleAnimations).get(replay.id);
            expect(state?.phase).toBe('starting');

            // Fast-forward through initial delay
            await vi.advanceTimersByTimeAsync(600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Should be in 'round' phase
            state = get(battleAnimations).get(replay.id);
            expect(state?.phase).toBe('round');
            expect(state?.currentRoundIndex).toBe(0);
            expect(state?.currentDiceRolls).toEqual({
                attacker: [6, 5],
                defender: [4, 3],
            });

            // Fast-forward through dice display delay
            await vi.advanceTimersByTimeAsync(400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Should show round result
            state = get(battleAnimations).get(replay.id);
            expect(state?.lastRoundResult).toEqual({
                attackerLost: 0,
                defenderLost: 1,
            });
            expect(state?.displayedAttackerShips).toBe(5);
            expect(state?.displayedDefenderShips).toBe(2);

            // Fast-forward through round delay
            await vi.advanceTimersByTimeAsync(500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Fast-forward to outcome phase (showOutcome has a 100ms delay, then phase is set to 'done')
            // Check state during the outcome phase by advancing just enough to trigger showOutcome
            await vi.advanceTimersByTimeAsync(50); // Part way through showOutcome delay

            state = get(battleAnimations).get(replay.id);
            // The phase might be 'outcome' or 'done' depending on timing, but outcomeMessage should be set
            expect(state?.outcomeMessage).toBe('Attacker conquers Test Planet!');
            expect(state?.currentDiceRolls).toBeNull();
            
            // Complete the outcome delay to see final state
            await vi.advanceTimersByTimeAsync(50);
            state = get(battleAnimations).get(replay.id);
            expect(state?.phase).toBe('done');
        });

        it('should play destruction sounds for casualties', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [6, 5],
                        defenderDice: [4, 3],
                        attackerLosses: 1,
                        defenderLosses: 2,
                        attackerShipsAfter: 4,
                        defenderShipsAfter: 1,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Fast-forward through initial delay and dice display
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED +
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED
            );

            // Fast-forward through sound delays (3 sounds max, 80ms delay each)
            await vi.advanceTimersByTimeAsync(3 * 80);

            // Should have played destruction sounds (up to 3 for 3 total casualties)
            const destructionCalls = mockPlaySound.mock.calls.filter(
                call => call[0] === 'SHIP_DESTROYED'
            );
            expect(destructionCalls.length).toBeGreaterThan(0);
            expect(destructionCalls.length).toBeLessThanOrEqual(3);
        });

        it('should handle multiple rounds', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [6, 5],
                        defenderDice: [4, 3],
                        attackerLosses: 0,
                        defenderLosses: 1,
                        attackerShipsAfter: 5,
                        defenderShipsAfter: 2,
                    },
                    {
                        roundNumber: 2,
                        attackerDice: [5, 4],
                        defenderDice: [3, 2],
                        attackerLosses: 0,
                        defenderLosses: 1,
                        attackerShipsAfter: 5,
                        defenderShipsAfter: 1,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Fast-forward through first round
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED // round delay
            );

            let state = get(battleAnimations).get(replay.id);
            expect(state?.currentRoundIndex).toBe(1); // Second round

            // Fast-forward through second round
            await vi.advanceTimersByTimeAsync(
                400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED // round delay
            );

            // Should have progressed through both rounds
            state = get(battleAnimations).get(replay.id);
            expect(state?.displayedDefenderShips).toBe(1);
        });

        it('should show correct outcome message for attacker victory', async () => {
            const replay = createMockBattleReplay({
                winnerId: 0,
                winnerShipsRemaining: 3,
            });

            queueBattleReplay(replay);

            // Fast-forward through entire animation
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 // outcome delay
            );

            const state = get(battleAnimations).get(replay.id);
            expect(state?.outcomeMessage).toBe('Attacker conquers Test Planet!');
            expect(mockPlaySound).toHaveBeenCalledWith('PLANET_CONQUERED');
        });

        it('should show correct outcome message for defender victory', async () => {
            const replay = createMockBattleReplay({
                winnerId: 1,
                winnerShipsRemaining: 2,
            });

            queueBattleReplay(replay);

            // Fast-forward through entire animation
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 // outcome delay
            );

            const state = get(battleAnimations).get(replay.id);
            expect(state?.outcomeMessage).toBe('Defender defend Test Planet!');
        });

        it('should show correct outcome message for mutual destruction', async () => {
            const replay = createMockBattleReplay({
                winnerId: null,
                winnerShipsRemaining: 0,
            });

            queueBattleReplay(replay);

            // Fast-forward through entire animation
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 // outcome delay
            );

            const state = get(battleAnimations).get(replay.id);
            expect(state?.outcomeMessage).toBe('Mutual destruction!');
        });

        it('should show default outcome message for unknown winner', async () => {
            const replay = createMockBattleReplay({
                winnerId: 999, // Unknown winner
                winnerShipsRemaining: 1,
            });

            queueBattleReplay(replay);

            // Fast-forward through entire animation
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 // outcome delay
            );

            const state = get(battleAnimations).get(replay.id);
            expect(state?.outcomeMessage).toBe('Test Planet defended!');
        });

        it('should mark animation as done and clean up after delay', async () => {
            const replay = createMockBattleReplay();

            queueBattleReplay(replay);

            // Fast-forward through entire animation including cleanup delay
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 + // outcome delay
                    2500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED // cleanup delay
            );

            // Animation should be removed
            expect(get(battleAnimations).has(replay.id)).toBe(false);
        });

        it('should handle animation cancellation gracefully', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [6, 5],
                        defenderDice: [4, 3],
                        attackerLosses: 0,
                        defenderLosses: 1,
                        attackerShipsAfter: 5,
                        defenderShipsAfter: 2,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Fast-forward through initial delay
            await vi.advanceTimersByTimeAsync(600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Remove animation mid-sequence
            removeBattleAnimation(replay.id);

            // Fast-forward through remaining delays
            await vi.advanceTimersByTimeAsync(10000);

            // Should not throw errors and animation should remain removed
            expect(get(battleAnimations).has(replay.id)).toBe(false);
        });

        it('should handle empty rounds array', async () => {
            const replay = createMockBattleReplay({
                rounds: [],
            });

            queueBattleReplay(replay);

            // Fast-forward through initial delay
            await vi.advanceTimersByTimeAsync(600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED);

            // Should proceed directly to outcome (showOutcome has a 100ms delay, then phase is set to 'done')
            // Check state during the outcome phase
            await vi.advanceTimersByTimeAsync(50); // Part way through showOutcome delay

            let state = get(battleAnimations).get(replay.id);
            // The phase might be 'outcome' or 'done' depending on timing, but outcomeMessage should be set
            expect(state?.outcomeMessage).toBe('Attacker conquers Test Planet!');
            
            // Complete the outcome delay to see final state
            await vi.advanceTimersByTimeAsync(50);
            state = get(battleAnimations).get(replay.id);
            expect(state?.phase).toBe('done');
        });
    });

    describe('edge cases', () => {
        it('should handle replay with no casualties', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [1, 1],
                        defenderDice: [1, 1],
                        attackerLosses: 0,
                        defenderLosses: 0,
                        attackerShipsAfter: 5,
                        defenderShipsAfter: 3,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Fast-forward through initial delay and dice display
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED +
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED
            );

            // Should not play destruction sounds
            const destructionCalls = mockPlaySound.mock.calls.filter(
                call => call[0] === 'SHIP_DESTROYED'
            );
            expect(destructionCalls.length).toBe(0);
        });

        it('should cap destruction sounds at 3 even with more casualties', async () => {
            const replay = createMockBattleReplay({
                rounds: [
                    {
                        roundNumber: 1,
                        attackerDice: [6, 5],
                        defenderDice: [4, 3],
                        attackerLosses: 2,
                        defenderLosses: 3, // 5 total casualties
                        attackerShipsAfter: 3,
                        defenderShipsAfter: 0,
                    },
                ],
            });

            queueBattleReplay(replay);

            // Fast-forward through initial delay and dice display
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED +
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED
            );

            // Fast-forward through sound delays
            await vi.advanceTimersByTimeAsync(3 * 80);

            // Should only play up to 3 sounds
            const destructionCalls = mockPlaySound.mock.calls.filter(
                call => call[0] === 'SHIP_DESTROYED'
            );
            expect(destructionCalls.length).toBeLessThanOrEqual(3);
        });

        it('should handle neutral planet defender in outcome', async () => {
            const replay = createMockBattleReplay({
                defenderPlayerId: -1,
                defenderName: 'Neutral',
                winnerId: 0,
            });

            queueBattleReplay(replay);

            // Fast-forward through entire animation
            await vi.advanceTimersByTimeAsync(
                600 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // initial delay
                    400 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // dice display
                    500 / GALACTIC_CONSTANTS.BATTLE_REPLAY_SPEED + // round delay
                    100 // outcome delay
            );

            const state = get(battleAnimations).get(replay.id);
            expect(state?.outcomeMessage).toBe('Attacker conquers Test Planet!');
        });
    });
});

