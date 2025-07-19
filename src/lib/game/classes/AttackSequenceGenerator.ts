import type { GameState } from '../GameState.ts';
import type { Player } from '../types.ts';
import { WorldConflictGameState } from "$lib/game/WorldConflictGameState.ts";

export interface AttackEvent {
    attackerCasualties?: number;
    defenderCasualties?: number;
    soundCue?: string;
    delay?: number;
    floatingText?: Array<{
        regionIdx: number;
        text: string;
        color: string;
        width: number;
    }>;
}

export interface ArmyMoveData {
    source: number;
    destination: number;
    count: number;
}

export class AttackSequenceGenerator {
    private fromRegion: number;
    private toRegion: number;
    private soldiers: number;
    private state: WorldConflictGameState | null = null;
    private incomingSoldiers: number;
    private fromOwner: Player | null;
    private toOwner: Player | null;

    private static readonly WIN_THRESHOLD = 120;

    constructor(armyMove: ArmyMoveData) {
        this.fromRegion = armyMove.source;
        this.toRegion = armyMove.destination;
        this.soldiers = armyMove.count;
        this.incomingSoldiers = 0;
        this.fromOwner = null;
        this.toOwner = null;
    }

    /**
     * Create attack sequence for combat resolution
     * Returns undefined if no combat needed (same owner)
     */
    createAttackSequenceIfFight(origState: WorldConflictGameState, players: Player[]): AttackEvent[] | undefined {
        this.state = origState.copy() as WorldConflictGameState;
        this.incomingSoldiers = this.soldiers;

        // WorldConflictGameState.owner() only takes regionIndex parameter
        this.fromOwner = this.state.owner(this.fromRegion);
        this.toOwner = this.state.owner(this.toRegion);

        // No fight if same owner
        if (this.fromOwner === this.toOwner) {
            return undefined;
        }

        const fromList = this.state.soldiersAtRegion(this.fromRegion);
        const toList = this.state.soldiersAtRegion(this.toRegion);
        const defendingSoldiers = toList.length;

        let attackSequence: AttackEvent[] = [];

        // Earth upgrade - preemptive defense damage
        const preemptiveDamage = Math.min(
            this.incomingSoldiers,
            this.state.upgradeLevel(this.toOwner, 'DEFENSE') || 0
        );

        if (preemptiveDamage > 0) {
            this.recordPreemptiveDamage(preemptiveDamage, attackSequence, fromList);
        }

        // Main combat if both sides still have forces
        if (defendingSoldiers > 0 && this.incomingSoldiers > 0) {
            this.recordFight(defendingSoldiers, attackSequence, fromList, toList);

            // Check if defenders won
            if (toList.length > 0) {
                const color = this.toOwner?.color || '#fff';
                attackSequence.push({
                    floatingText: [{
                        regionIdx: this.toRegion,
                        color,
                        text: "Defended!",
                        width: 7
                    }]
                });
            }
        }

        return attackSequence;
    }

    private recordPreemptiveDamage(
        damage: number,
        attackSequence: AttackEvent[],
        fromList: { i: number }[]
    ): void {
        // Remove soldiers from attacking force
        for (let i = 0; i < damage && fromList.length > 0; i++) {
            fromList.pop();
        }

        this.incomingSoldiers -= damage;

        attackSequence.push({
            attackerCasualties: damage,
            soundCue: 'ATTACKER_CASUALTIES',
            delay: 50,
            floatingText: [{
                regionIdx: this.toRegion,
                text: `Earth kills ${damage}!`,
                color: '#8B4513',
                width: 8
            }]
        });
    }

    private recordFight(
        defendingSoldiers: number,
        attackSequence: AttackEvent[],
        fromList: { i: number }[],
        toList: { i: number }[]
    ): void {
        if (!this.state) return;

        // Simple combat resolution - this is a placeholder implementation
        // You'll need to implement the actual combat logic based on your game rules
        const attackerCasualties = Math.floor(Math.random() * Math.min(this.incomingSoldiers, defendingSoldiers));
        const defenderCasualties = Math.floor(Math.random() * Math.min(defendingSoldiers, this.incomingSoldiers));

        // Remove casualties
        for (let i = 0; i < attackerCasualties && fromList.length > 0; i++) {
            fromList.pop();
        }

        for (let i = 0; i < defenderCasualties && toList.length > 0; i++) {
            toList.pop();
        }

        this.incomingSoldiers -= attackerCasualties;

        attackSequence.push({
            attackerCasualties,
            defenderCasualties,
            soundCue: 'COMBAT',
            delay: 100,
            floatingText: [
                {
                    regionIdx: this.fromRegion,
                    text: `-${attackerCasualties}`,
                    color: '#ff0000',
                    width: 3
                },
                {
                    regionIdx: this.toRegion,
                    text: `-${defenderCasualties}`,
                    color: '#ff0000',
                    width: 3
                }
            ]
        });
    }
}
