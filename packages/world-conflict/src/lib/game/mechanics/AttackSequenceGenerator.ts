import type { Player, GameState } from '$lib/game/state/GameState.ts';
import type { RandomNumberGenerator } from '$lib/game/utils/RandomNumberGenerator';

export interface AttackEvent {
    attackerCasualties?: number;      // Casualties in this round only
    defenderCasualties?: number;      // Casualties in this round only
    runningAttackerTotal?: number;    // Total attacker casualties so far
    runningDefenderTotal?: number;    // Total defender casualties so far
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
    private state: GameState | null = null;
    private incomingSoldiers: number;
    private fromOwner: number | undefined;
    private toOwner: number | undefined;
    private rng: RandomNumberGenerator;
    private isSimulation: boolean = false;

    private static readonly WIN_THRESHOLD = 120;

    constructor(armyMove: ArmyMoveData, rng: RandomNumberGenerator, isSimulation: boolean = false) {
        this.fromRegion = armyMove.source;
        this.toRegion = armyMove.destination;
        this.soldiers = armyMove.count;
        this.incomingSoldiers = 0;
        this.fromOwner = undefined;
        this.toOwner = undefined;
        this.rng = rng;
        this.isSimulation = isSimulation;
    }

    /**
     * Create attack sequence for combat resolution
     * Returns undefined if no combat needed (same owner)
     */
    createAttackSequenceIfFight(origState: GameState, players: Player[]): AttackEvent[] | undefined {
        this.state = origState.copy() as GameState;
        this.incomingSoldiers = this.soldiers;


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

        let preemptiveCasualties = 0;
        if (preemptiveDamage > 0) {
            preemptiveCasualties = preemptiveDamage;
            this.recordPreemptiveDamage(preemptiveDamage, attackSequence, fromList);
        }

        // Main combat if both sides still have forces
        if (defendingSoldiers > 0 && this.incomingSoldiers > 0) {
            this.recordFight(defendingSoldiers, attackSequence, fromList, toList, preemptiveCasualties);

            // Check if defenders won
            if (toList.length > 0) {
                const toOwnerPlayer = this.toOwner !== undefined ? players.find(p => p.slotIndex === this.toOwner) : undefined;
                const color = toOwnerPlayer?.color || '#fff';
                attackSequence.push({
                    floatingText: [{
                        regionIdx: this.toRegion,
                        color,
                        text: "Defended!",
                        width: 7
                    }]
                });
            } else {
                // Attackers won - show "Conquered!" text
                const fromOwnerPlayer = this.fromOwner !== undefined ? players.find(p => p.slotIndex === this.fromOwner) : undefined;
                const color = '#ffee11'; // Gold/yellow color
                attackSequence.push({
                    floatingText: [{
                        regionIdx: this.toRegion,
                        color,
                        text: "Conquered!",
                        width: 7
                    }]
                });
            }
        } else if (defendingSoldiers === 0 && this.incomingSoldiers > 0) {
            // No combat needed - neutral region conquered
            attackSequence.push({
                floatingText: [{
                    regionIdx: this.toRegion,
                    color: '#ffee11', // Gold/yellow color
                    text: "Conquered!",
                    width: 7
                }]
            });
        }

        // Add final delay to allow smoke animations to complete
        attackSequence.push({
            delay: 600 // Extra time for final smoke effects to fade out
        });

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
            defenderCasualties: 0,
            runningAttackerTotal: damage,
            runningDefenderTotal: 0,
            soundCue: 'ATTACK',
            delay: 800, // 800ms to allow smoke animation to be visible
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
        toList: { i: number }[],
        preemptiveCasualties: number = 0
    ): void {
        if (!this.state) return;

        if (!this.isSimulation) {
            console.log(`🎲 Combat: ${this.incomingSoldiers} attackers vs ${defendingSoldiers} defenders`);
        }

        // Conduct battle rounds until one side is eliminated
        let attackersRemaining = this.incomingSoldiers;
        let defendersRemaining = defendingSoldiers;
        // Start with preemptive casualties if any
        let totalAttackerCasualties = preemptiveCasualties;
        let totalDefenderCasualties = 0;

        // Continue battle until one side has no soldiers
        // Emit a separate event for each round
        while (attackersRemaining > 0 && defendersRemaining > 0) {
            const battleResult = this.resolveBattleRound(attackersRemaining, defendersRemaining);

            attackersRemaining -= battleResult.attackerCasualties;
            defendersRemaining -= battleResult.defenderCasualties;
            totalAttackerCasualties += battleResult.attackerCasualties;
            totalDefenderCasualties += battleResult.defenderCasualties;

            if (!this.isSimulation) {
                console.log(`🎲 Battle round: A-${battleResult.attackerCasualties} D-${battleResult.defenderCasualties} | Remaining: A${attackersRemaining} D${defendersRemaining}`);
            }

            // Emit a separate event for this round with running totals
            attackSequence.push({
                attackerCasualties: battleResult.attackerCasualties,
                defenderCasualties: battleResult.defenderCasualties,
                runningAttackerTotal: totalAttackerCasualties,
                runningDefenderTotal: totalDefenderCasualties,
                soundCue: 'COMBAT',
                delay: 800 // 800ms between rounds to allow smoke animation to be visible
            });

            // Remove casualties from actual soldier arrays after each round
            for (let i = 0; i < battleResult.attackerCasualties && fromList.length > 0; i++) {
                fromList.pop();
            }

            for (let i = 0; i < battleResult.defenderCasualties && toList.length > 0; i++) {
                toList.pop();
            }
        }

        this.incomingSoldiers = attackersRemaining;

        const winner = defendersRemaining > 0 ? 'defender' : 'attacker';
        if (!this.isSimulation) {
            console.log(`Battle result: ${winner} wins! Final: A${attackersRemaining} D${defendersRemaining}`);
        }
    }

    /**
     * Resolve a single round of Risk-style combat
     * Returns casualties for this round only
     */
    private resolveBattleRound(attackers: number, defenders: number): {
        attackerCasualties: number;
        defenderCasualties: number;
    } {
        // Risk-style dice rules:
        // - Attackers roll up to 3 dice (but need to have enough soldiers)
        // - Defenders roll up to 2 dice
        // - Compare highest dice, then second highest if both sides have multiple
        // - Ties go to defender

        const attackerDice = Math.min(3, attackers);
        const defenderDice = Math.min(2, defenders);

        // Roll dice for both sides
        const attackerRolls = this.rollDice(attackerDice).sort((a, b) => b - a); // Highest first
        const defenderRolls = this.rollDice(defenderDice).sort((a, b) => b - a); // Highest first

        //console.log(`Dice - Attackers: [${attackerRolls.join(',')}] vs Defenders: [${defenderRolls.join(',')}]`);

        let attackerCasualties = 0;
        let defenderCasualties = 0;

        // Compare dice results
        // First comparison (highest dice)
        if (attackerRolls[0] > defenderRolls[0]) {
            defenderCasualties++;
            //console.log(`   Round 1: Attacker ${attackerRolls[0]} > Defender ${defenderRolls[0]} - Defender loses 1`);
        } else {
            attackerCasualties++;
            //console.log(`   Round 1: Attacker ${attackerRolls[0]} ≤ Defender ${defenderRolls[0]} - Attacker loses 1`);
        }

        // Second comparison (if both sides have multiple dice)
        if (attackerRolls.length > 1 && defenderRolls.length > 1) {
            if (attackerRolls[1] > defenderRolls[1]) {
                defenderCasualties++;
                //console.log(`   Round 2: Attacker ${attackerRolls[1]} > Defender ${defenderRolls[1]} - Defender loses 1`);
            } else {
                attackerCasualties++;
                //console.log(`   Round 2: Attacker ${attackerRolls[1]} ≤ Defender ${defenderRolls[1]} - Attacker loses 1`);
            }
        }

        return { attackerCasualties, defenderCasualties };
    }

    /**
     * Roll the specified number of 6-sided dice
     */
    private rollDice(count: number): number[] {
        const rolls: number[] = [];
        for (let i = 0; i < count; i++) {
            rolls.push(this.rng.rollDice(6)); // 1-6
        }
        return rolls;
    }
}
