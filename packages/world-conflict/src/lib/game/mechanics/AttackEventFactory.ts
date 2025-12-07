import type { Player } from '$lib/game/entities/gameTypes';
import type { BattleRoundResult } from './BattleRound';

/**
 * Represents a single event in an attack sequence for UI/animation purposes
 */
export interface AttackEvent {
    attackerCasualties?: number;
    defenderCasualties?: number;
    runningAttackerTotal?: number;
    runningDefenderTotal?: number;
    soundCue?: string;
    delay?: number;
    floatingText?: Array<{
        regionIdx: number;
        text: string;
        color: string;
        width: number;
    }>;
    isRetreat?: boolean;
}

/**
 * Factory for creating AttackEvent objects used in combat animations
 */
export class AttackEventFactory {
    private static readonly CONQUERED_TEXT = 'Conquered!';
    private static readonly DEFENDED_TEXT = 'Defended!';
    private static readonly RETREAT_TEXT = 'Retreat!';
    private static readonly CONQUERED_COLOR = '#ffee11';
    private static readonly RETREAT_COLOR = '#ff6b6b';

    private static readonly BATTLE_ROUND_DELAY = 800;
    private static readonly FINAL_DELAY = 600;
    private static readonly DEFAULT_TEXT_WIDTH = 7;
    private static readonly PREEMPTIVE_TEXT_WIDTH = 8;

    /**
     * Create a floating text event for a region
     */
    createFloatingText(regionIdx: number, color: string, text: string): AttackEvent {
        return {
            floatingText: [{
                regionIdx,
                color,
                text,
                width: AttackEventFactory.DEFAULT_TEXT_WIDTH
            }]
        };
    }

    /**
     * Create the "Conquered!" outcome event
     */
    createConqueredEvent(toRegion: number): AttackEvent {
        return this.createFloatingText(
            toRegion,
            AttackEventFactory.CONQUERED_COLOR,
            AttackEventFactory.CONQUERED_TEXT
        );
    }

    /**
     * Create the "Defended!" outcome event
     */
    createDefendedEvent(toRegion: number, players: Player[], toOwner: number | undefined): AttackEvent {
        const toOwnerPlayer = toOwner !== undefined 
            ? players.find(p => p.slotIndex === toOwner) 
            : undefined;
        const color = toOwnerPlayer?.color || '#fff';
        return this.createFloatingText(
            toRegion,
            color,
            AttackEventFactory.DEFENDED_TEXT
        );
    }

    /**
     * Create the "Retreat!" outcome event
     */
    createRetreatEvent(fromRegion: number): AttackEvent {
        return {
            ...this.createFloatingText(
                fromRegion,
                AttackEventFactory.RETREAT_COLOR,
                AttackEventFactory.RETREAT_TEXT
            ),
            isRetreat: true
        };
    }

    /**
     * Create an event for a battle round result
     */
    createBattleRoundEvent(
        battleResult: BattleRoundResult,
        totalAttackerCasualties: number,
        totalDefenderCasualties: number
    ): AttackEvent {
        return {
            attackerCasualties: battleResult.attackerCasualties,
            defenderCasualties: battleResult.defenderCasualties,
            runningAttackerTotal: totalAttackerCasualties,
            runningDefenderTotal: totalDefenderCasualties,
            soundCue: 'COMBAT',
            delay: AttackEventFactory.BATTLE_ROUND_DELAY
        };
    }

    /**
     * Create an event for preemptive damage (defense upgrade)
     */
    createPreemptiveDamageEvent(
        damage: number,
        toRegion: number
    ): AttackEvent {
        return {
            attackerCasualties: damage,
            defenderCasualties: 0,
            runningAttackerTotal: damage,
            runningDefenderTotal: 0,
            soundCue: 'ATTACK',
            delay: AttackEventFactory.BATTLE_ROUND_DELAY,
            floatingText: [{
                regionIdx: toRegion,
                text: `Earth kills ${damage}!`,
                color: '#8B4513',
                width: AttackEventFactory.PREEMPTIVE_TEXT_WIDTH
            }]
        };
    }

    /**
     * Create a final delay event
     */
    createFinalDelayEvent(): AttackEvent {
        return { delay: AttackEventFactory.FINAL_DELAY };
    }
}


