import type { Player } from '$lib/game/entities/gameTypes';
import type { GameState } from '$lib/game/state/GameState';
import type { RandomNumberGenerator } from '$lib/game/utils/RandomNumberGenerator';
import { logger } from '$lib/game/utils/logger';

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
    isRetreat?: boolean;              // Signals that attackers are retreating (lost >50% of initial force)
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
    private static readonly CONQUERED_TEXT = 'Conquered!';
    private static readonly DEFENDED_TEXT = 'Defended!';
    private static readonly RETREAT_TEXT = 'Retreat!';
    private static readonly CONQUERED_COLOR = '#ffee11'; // Gold/yellow color
    private static readonly RETREAT_COLOR = '#ff6b6b'; // Red color for retreat

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
            const didRetreat = this.recordFight(defendingSoldiers, attackSequence, fromList, toList, preemptiveCasualties);

            if (didRetreat) {
                // Attackers retreated - show "Retreat!" text for attackers
                attackSequence.push({
                    ...this.createFloatingText(this.fromRegion, AttackSequenceGenerator.RETREAT_COLOR, AttackSequenceGenerator.RETREAT_TEXT),
                    isRetreat: true
                });
                // Show "Defended!" text for defenders
                const toOwnerPlayer = this.toOwner !== undefined ? players.find(p => p.slotIndex === this.toOwner) : undefined;
                const color = toOwnerPlayer?.color || '#fff';
                attackSequence.push(
                    this.createFloatingText(this.toRegion, color, AttackSequenceGenerator.DEFENDED_TEXT)
                );
            } else if (toList.length > 0) {
                // Defenders won (attackers eliminated)
                const toOwnerPlayer = this.toOwner !== undefined ? players.find(p => p.slotIndex === this.toOwner) : undefined;
                const color = toOwnerPlayer?.color || '#fff';
                attackSequence.push(
                    this.createFloatingText(this.toRegion, color, AttackSequenceGenerator.DEFENDED_TEXT)
                );
            } else {
                // Attackers won - show "Conquered!" text
                attackSequence.push(
                    this.createFloatingText(this.toRegion, AttackSequenceGenerator.CONQUERED_COLOR, AttackSequenceGenerator.CONQUERED_TEXT)
                );
            }
        } else if (defendingSoldiers === 0 && this.incomingSoldiers > 0) {
            // No combat needed - neutral region conquered
            attackSequence.push(
                this.createFloatingText(this.toRegion, AttackSequenceGenerator.CONQUERED_COLOR, AttackSequenceGenerator.CONQUERED_TEXT)
            );
        }

        // Add final delay to allow smoke animations to complete
        attackSequence.push({
            delay: 600 // Extra time for final smoke effects to fade out
        });

        return attackSequence;
    }

    /**
     * Create a floating text event
     */
    private createFloatingText(regionIdx: number, color: string, text: string): AttackEvent {
        return {
            floatingText: [{
                regionIdx,
                color,
                text,
                width: 7
            }]
        };
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

    /**
     * Record the fight between attackers and defenders
     * Returns true if attackers retreated (lost >50% of initial force)
     */
    private recordFight(
        defendingSoldiers: number,
        attackSequence: AttackEvent[],
        fromList: { i: number }[],
        toList: { i: number }[],
        preemptiveCasualties: number = 0
    ): boolean {
        if (!this.state) return false;

        // Track initial attacker count for retreat calculation
        const initialAttackers = this.incomingSoldiers;
        const retreatThreshold = Math.floor(initialAttackers / 2);

        if (!this.isSimulation) {
            logger.debug(`🎲 Combat: ${this.incomingSoldiers} attackers vs ${defendingSoldiers} defenders (retreat if >${retreatThreshold} casualties)`);
        }

        // Conduct battle rounds until one side is eliminated or attackers retreat
        let attackersRemaining = this.incomingSoldiers;
        let defendersRemaining = defendingSoldiers;
        // Start with preemptive casualties if any
        let totalAttackerCasualties = preemptiveCasualties;
        let totalDefenderCasualties = 0;

        // Check if preemptive damage already triggered retreat
        if (totalAttackerCasualties > retreatThreshold && attackersRemaining > 0 && defendersRemaining > 0) {
            if (!this.isSimulation) {
                logger.debug(`🏃 Retreat triggered by preemptive damage! Casualties: ${totalAttackerCasualties}/${initialAttackers}`);
            }
            this.incomingSoldiers = attackersRemaining;
            return true;
        }

        // Continue battle until one side has no soldiers or attackers retreat
        // Emit a separate event for each round
        while (attackersRemaining > 0 && defendersRemaining > 0) {
            const battleResult = this.resolveBattleRound(attackersRemaining, defendersRemaining);

            attackersRemaining -= battleResult.attackerCasualties;
            defendersRemaining -= battleResult.defenderCasualties;
            totalAttackerCasualties += battleResult.attackerCasualties;
            totalDefenderCasualties += battleResult.defenderCasualties;

            if (!this.isSimulation) {
                logger.debug(`🎲 Battle round: A-${battleResult.attackerCasualties} D-${battleResult.defenderCasualties} | Remaining: A${attackersRemaining} D${defendersRemaining}`);
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

            // Check for retreat: if attackers lost more than half of initial force, retreat
            if (totalAttackerCasualties > retreatThreshold && attackersRemaining > 0 && defendersRemaining > 0) {
                if (!this.isSimulation) {
                    logger.debug(`🏃 Retreat! Attackers lost ${totalAttackerCasualties}/${initialAttackers} (>${retreatThreshold}). ${attackersRemaining} survivors retreating.`);
                }
                this.incomingSoldiers = attackersRemaining;
                return true;
            }
        }

        this.incomingSoldiers = attackersRemaining;

        const winner = defendersRemaining > 0 ? 'defender' : 'attacker';
        if (!this.isSimulation) {
            logger.debug(`Battle result: ${winner} wins! Final: A${attackersRemaining} D${defendersRemaining}`);
        }
        return false;
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
        // - Compare the highest dice, then second highest if both sides have multiple
        // - Ties go to defender

        const attackerDice = Math.min(3, attackers);
        const defenderDice = Math.min(2, defenders);

        // Roll dice for both sides
        const attackerRolls = this.rollDice(attackerDice).sort((a, b) => b - a); // Highest first
        const defenderRolls = this.rollDice(defenderDice).sort((a, b) => b - a); // Highest first

        let attackerCasualties = 0;
        let defenderCasualties = 0;

        // Compare dice results
        // First comparison (highest dice)
        if (attackerRolls[0] > defenderRolls[0]) {
            defenderCasualties++;
        } else {
            attackerCasualties++;
        }

        // Second comparison (if both sides have multiple dice)
        if (attackerRolls.length > 1 && defenderRolls.length > 1) {
            if (attackerRolls[1] > defenderRolls[1]) {
                defenderCasualties++;
            } else {
                attackerCasualties++;
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
