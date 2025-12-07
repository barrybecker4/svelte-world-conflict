import type { RandomNumberGenerator } from '$lib/game/utils/RandomNumberGenerator';

/**
 * Result of a single battle round
 */
export interface BattleRoundResult {
    attackerCasualties: number;
    defenderCasualties: number;
}

/**
 * Handles Risk-style dice combat resolution for a single round.
 * 
 * Rules:
 * - Attackers roll up to 3 dice (limited by soldier count)
 * - Defenders roll up to 2 dice (limited by soldier count)
 * - Compare highest dice, then second highest if both sides have multiple
 * - Ties go to defender
 */
export class BattleRound {
    private static readonly MAX_ATTACKER_DICE = 3;
    private static readonly MAX_DEFENDER_DICE = 2;
    private static readonly DICE_SIDES = 6;

    constructor(private rng: RandomNumberGenerator) {}

    /**
     * Resolve a single round of Risk-style combat
     * @param attackers - Number of attacking soldiers
     * @param defenders - Number of defending soldiers
     * @returns Casualties for each side in this round
     */
    resolve(attackers: number, defenders: number): BattleRoundResult {
        const attackerDice = Math.min(BattleRound.MAX_ATTACKER_DICE, attackers);
        const defenderDice = Math.min(BattleRound.MAX_DEFENDER_DICE, defenders);

        const attackerRolls = this.rollDice(attackerDice).sort((a, b) => b - a);
        const defenderRolls = this.rollDice(defenderDice).sort((a, b) => b - a);

        let attackerCasualties = 0;
        let defenderCasualties = 0;

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
            rolls.push(this.rng.rollDice(BattleRound.DICE_SIDES));
        }
        return rolls;
    }
}


