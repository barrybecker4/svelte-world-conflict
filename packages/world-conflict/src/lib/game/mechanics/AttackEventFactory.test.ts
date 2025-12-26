/**
 * Unit tests for AttackEventFactory
 * Tests creation of AttackEvent objects for combat animations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AttackEventFactory, type AttackEvent } from './AttackEventFactory';
import type { Player } from '$lib/game/entities/gameTypes';
import type { BattleRoundResult } from './BattleRound';

// Helper to create mock players
function createPlayer(slotIndex: number, color: string): Player {
    return {
        slotIndex,
        name: `Player ${slotIndex}`,
        color,
        isAI: false
    };
}

describe('AttackEventFactory', () => {
    let factory: AttackEventFactory;

    beforeEach(() => {
        factory = new AttackEventFactory();
    });

    describe('createFloatingText', () => {
        it('should create event with correct structure', () => {
            const event = factory.createFloatingText(5, '#ff0000', 'Test Message');

            expect(event.floatingText).toBeDefined();
            expect(event.floatingText).toHaveLength(1);
            expect(event.floatingText![0].regionIdx).toBe(5);
            expect(event.floatingText![0].color).toBe('#ff0000');
            expect(event.floatingText![0].text).toBe('Test Message');
            expect(event.floatingText![0].width).toBe(7); // DEFAULT_TEXT_WIDTH
        });

        it('should not include other event properties', () => {
            const event = factory.createFloatingText(0, '#fff', 'Text');

            expect(event.attackerCasualties).toBeUndefined();
            expect(event.defenderCasualties).toBeUndefined();
            expect(event.soundCue).toBeUndefined();
            expect(event.delay).toBeUndefined();
            expect(event.isRetreat).toBeUndefined();
        });
    });

    describe('createConqueredEvent', () => {
        it('should create event with "Conquered!" text', () => {
            const event = factory.createConqueredEvent(3);

            expect(event.floatingText).toBeDefined();
            expect(event.floatingText![0].text).toBe('Conquered!');
        });

        it('should use gold/yellow color', () => {
            const event = factory.createConqueredEvent(3);

            expect(event.floatingText![0].color).toBe('#ffee11');
        });

        it('should target the specified region', () => {
            const event = factory.createConqueredEvent(7);

            expect(event.floatingText![0].regionIdx).toBe(7);
        });
    });

    describe('createDefendedEvent', () => {
        it('should create event with "Defended!" text', () => {
            const players = [createPlayer(0, '#ff0000'), createPlayer(1, '#0000ff')];
            const event = factory.createDefendedEvent(3, players, 1);

            expect(event.floatingText).toBeDefined();
            expect(event.floatingText![0].text).toBe('Defended!');
        });

        it('should use defender player color', () => {
            const players = [createPlayer(0, '#ff0000'), createPlayer(1, '#00ff00')];
            const event = factory.createDefendedEvent(3, players, 1);

            expect(event.floatingText![0].color).toBe('#00ff00');
        });

        it('should use white color when owner is undefined', () => {
            const players = [createPlayer(0, '#ff0000')];
            const event = factory.createDefendedEvent(3, players, undefined);

            expect(event.floatingText![0].color).toBe('#fff');
        });

        it('should use white color when owner not found in players', () => {
            const players = [createPlayer(0, '#ff0000')];
            const event = factory.createDefendedEvent(3, players, 5); // Player 5 doesn't exist

            expect(event.floatingText![0].color).toBe('#fff');
        });

        it('should target the specified region', () => {
            const players = [createPlayer(0, '#ff0000')];
            const event = factory.createDefendedEvent(9, players, 0);

            expect(event.floatingText![0].regionIdx).toBe(9);
        });
    });

    describe('createRetreatEvent', () => {
        it('should create event with "Retreat!" text', () => {
            const event = factory.createRetreatEvent(2);

            expect(event.floatingText).toBeDefined();
            expect(event.floatingText![0].text).toBe('Retreat!');
        });

        it('should use red retreat color', () => {
            const event = factory.createRetreatEvent(2);

            expect(event.floatingText![0].color).toBe('#ff6b6b');
        });

        it('should set isRetreat flag to true', () => {
            const event = factory.createRetreatEvent(2);

            expect(event.isRetreat).toBe(true);
        });

        it('should target the source region (where attackers retreat to)', () => {
            const event = factory.createRetreatEvent(4);

            expect(event.floatingText![0].regionIdx).toBe(4);
        });
    });

    describe('createBattleRoundEvent', () => {
        it('should include casualties from battle result', () => {
            const battleResult: BattleRoundResult = {
                attackerCasualties: 1,
                defenderCasualties: 2
            };

            const event = factory.createBattleRoundEvent(battleResult, 5, 3);

            expect(event.attackerCasualties).toBe(1);
            expect(event.defenderCasualties).toBe(2);
        });

        it('should include running totals', () => {
            const battleResult: BattleRoundResult = {
                attackerCasualties: 1,
                defenderCasualties: 1
            };

            const event = factory.createBattleRoundEvent(battleResult, 10, 8);

            expect(event.runningAttackerTotal).toBe(10);
            expect(event.runningDefenderTotal).toBe(8);
        });

        it('should set COMBAT sound cue', () => {
            const battleResult: BattleRoundResult = {
                attackerCasualties: 1,
                defenderCasualties: 0
            };

            const event = factory.createBattleRoundEvent(battleResult, 1, 0);

            expect(event.soundCue).toBe('COMBAT');
        });

        it('should set 800ms delay', () => {
            const battleResult: BattleRoundResult = {
                attackerCasualties: 0,
                defenderCasualties: 1
            };

            const event = factory.createBattleRoundEvent(battleResult, 0, 1);

            expect(event.delay).toBe(800);
        });

        it('should not include floating text', () => {
            const battleResult: BattleRoundResult = {
                attackerCasualties: 1,
                defenderCasualties: 1
            };

            const event = factory.createBattleRoundEvent(battleResult, 2, 2);

            expect(event.floatingText).toBeUndefined();
        });
    });

    describe('createPreemptiveDamageEvent', () => {
        it('should show correct damage amount', () => {
            const event = factory.createPreemptiveDamageEvent(3, 5);

            expect(event.attackerCasualties).toBe(3);
            expect(event.defenderCasualties).toBe(0);
        });

        it('should set running totals correctly', () => {
            const event = factory.createPreemptiveDamageEvent(2, 5);

            expect(event.runningAttackerTotal).toBe(2);
            expect(event.runningDefenderTotal).toBe(0);
        });

        it('should include "Earth kills X!" floating text', () => {
            const event = factory.createPreemptiveDamageEvent(4, 7);

            expect(event.floatingText).toBeDefined();
            expect(event.floatingText![0].text).toBe('Earth kills 4!');
        });

        it('should use brown earth color', () => {
            const event = factory.createPreemptiveDamageEvent(1, 0);

            expect(event.floatingText![0].color).toBe('#8B4513');
        });

        it('should target the defender region', () => {
            const event = factory.createPreemptiveDamageEvent(2, 12);

            expect(event.floatingText![0].regionIdx).toBe(12);
        });

        it('should use wider text width', () => {
            const event = factory.createPreemptiveDamageEvent(1, 0);

            expect(event.floatingText![0].width).toBe(8); // PREEMPTIVE_TEXT_WIDTH
        });

        it('should set ATTACK sound cue', () => {
            const event = factory.createPreemptiveDamageEvent(1, 0);

            expect(event.soundCue).toBe('ATTACK');
        });

        it('should set 800ms delay', () => {
            const event = factory.createPreemptiveDamageEvent(1, 0);

            expect(event.delay).toBe(800);
        });
    });

    describe('createFinalDelayEvent', () => {
        it('should create event with 600ms delay', () => {
            const event = factory.createFinalDelayEvent();

            expect(event.delay).toBe(600);
        });

        it('should not include other properties', () => {
            const event = factory.createFinalDelayEvent();

            expect(event.attackerCasualties).toBeUndefined();
            expect(event.defenderCasualties).toBeUndefined();
            expect(event.soundCue).toBeUndefined();
            expect(event.floatingText).toBeUndefined();
            expect(event.isRetreat).toBeUndefined();
        });
    });
});
