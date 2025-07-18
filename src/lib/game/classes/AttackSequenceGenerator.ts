import type { GameState } from '../GameState.ts';
import type { Player } from '../types.ts';

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
    private state: GameState;
    private incomingSoldiers: number;
    private fromOwner: Player | null;
    private toOwner: Player | null;

    // Combat constants
    private static readonly WIN_THRESHOLD = 120;

    constructor(armyMove: ArmyMoveData) {
        this.fromRegion = armyMove.source;
        this.toRegion = armyMove.destination;
        this.soldiers = armyMove.count;
    }

    /**
     * Create attack sequence for combat resolution
     * Returns undefined if no combat needed (same owner)
     */
    createAttackSequenceIfFight(origState: GameState, players: Player[]): AttackEvent[] | undefined {
        this.state = origState.copy();
        this.incomingSoldiers = this.soldiers;

        this.fromOwner = this.state.owner(this.fromRegion, players);
        this.toOwner = this.state.owner(this.toRegion, players);

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

        return attackSequence.length > 0 ? attackSequence : undefined;
    }

    private recordPreemptiveDamage(
        damage: number,
        sequence: AttackEvent[],
        fromList: any[]
    ): void {
        sequence.push({
            delay: 50,
            floatingText: [{
                regionIdx: this.toRegion,
                text: `Defense kills ${damage}!`,
                color: '#8B5CF6', // Purple for defense magic
                width: 9
            }]
        });

        // Remove attacking soldiers
        for (let i = 0; i < damage; i++) {
            fromList.shift();
            this.incomingSoldiers--;
        }

        sequence.push({
            attackerCasualties: damage
        });
    }

    private recordFight(
        defendingSoldiers: number,
        sequence: AttackEvent[],
        fromList: any[],
        toList: any[]
    ): void {
        // Calculate combat strengths with upgrades
        const attackBonus = this.state.upgradeLevel(this.fromOwner, 'AIR') || 0;
        const defenseBonus = this.state.upgradeLevel(this.toOwner, 'DEFENSE') || 0;

        const incomingStrength = this.incomingSoldiers * (1 + attackBonus * 0.01);
        const defendingStrength = defendingSoldiers * (1 + defenseBonus * 0.01);

        const repeats = Math.min(this.incomingSoldiers, defendingSoldiers);
        const attackerWinChance = 100 * Math.pow(incomingStrength / defendingStrength, 1.6);

        // Fire upgrade provides invincibility
        let invincibility = this.state.upgradeLevel(this.fromOwner, 'AIR') || 0;

        for (let i = 0; i < repeats; i++) {
            const rndNum = this.randomNumberForFight(i, attackerWinChance, repeats);

            if (rndNum <= AttackSequenceGenerator.WIN_THRESHOLD) {
                // Defender wins this round
                if (invincibility > 0) {
                    invincibility--;
                    sequence.push({
                        delay: 800,
                        floatingText: [{
                            regionIdx: this.fromRegion,
                            text: "Protected by Air!",
                            color: '#06B6D4', // Cyan for air magic
                            width: 10
                        }]
                    });
                } else {
                    fromList.shift();
                    this.incomingSoldiers--;
                    sequence.push({
                        attackerCasualties: 1,
                        soundCue: 'defeat',
                        delay: 250
                    });
                }
            } else {
                // Attacker wins this round
                toList.shift();
                sequence.push({
                    defenderCasualties: 1,
                    soundCue: 'victory',
                    delay: 250
                });
            }
        }
    }

    private randomNumberForFight(index: number, attackerWinChance: number, repeats: number): number {
        // Deterministic randomness based on combat parameters
        const seed = this.fromRegion + this.toRegion + index + this.soldiers;
        return (Math.sin(seed) * 10000) % 200;
    }
}
