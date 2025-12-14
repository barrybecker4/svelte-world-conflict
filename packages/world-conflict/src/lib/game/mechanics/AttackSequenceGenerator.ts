import type { Player } from '$lib/game/entities/gameTypes';
import type { GameState } from '$lib/game/state/GameState';
import type { RandomNumberGenerator } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';
import { BattleRound } from './BattleRound';
import { AttackEventFactory, type AttackEvent } from './AttackEventFactory';

export type { AttackEvent } from './AttackEventFactory';

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
    private isSimulation: boolean = false;

    private readonly battleRound: BattleRound;
    private readonly eventFactory: AttackEventFactory;

    constructor(armyMove: ArmyMoveData, rng: RandomNumberGenerator, isSimulation: boolean = false) {
        this.fromRegion = armyMove.source;
        this.toRegion = armyMove.destination;
        this.soldiers = armyMove.count;
        this.incomingSoldiers = 0;
        this.fromOwner = undefined;
        this.toOwner = undefined;
        this.isSimulation = isSimulation;
        this.battleRound = new BattleRound(rng);
        this.eventFactory = new AttackEventFactory();
    }

    /**
     * Create attack sequence for combat resolution
     * Returns undefined if no combat needed (same owner)
     */
    createAttackSequenceIfFight(origState: GameState, players: Player[]): AttackEvent[] | undefined {
        this.initializeCombatState(origState);

        if (this.isSameOwner()) {
            return undefined;
        }

        const fromList = this.state!.soldiersAtRegion(this.fromRegion);
        const toList = this.state!.soldiersAtRegion(this.toRegion);
        let defendingSoldiers = toList.length;

        const attackSequence: AttackEvent[] = [];
        
        // Apply Earth (defense) preemptive damage to attackers
        const preemptiveCasualties = this.applyPreemptiveDamage(attackSequence, fromList);
        
        // Apply Fire (attack) preemptive damage to defenders
        const fireDefenderCasualties = this.applyFireDamage(attackSequence, toList, preemptiveCasualties);
        defendingSoldiers -= fireDefenderCasualties;

        if (this.hasBothSidesWithForces(defendingSoldiers)) {
            this.resolveCombatWithOutcome(attackSequence, fromList, toList, defendingSoldiers, preemptiveCasualties, players);
        } else if (this.canConquerUndefendedRegion(defendingSoldiers)) {
            attackSequence.push(this.eventFactory.createConqueredEvent(this.toRegion));
        }

        attackSequence.push(this.eventFactory.createFinalDelayEvent());
        return attackSequence;
    }

    private initializeCombatState(origState: GameState): void {
        this.state = origState.copy() as GameState;
        this.incomingSoldiers = this.soldiers;
        this.fromOwner = this.state.owner(this.fromRegion);
        this.toOwner = this.state.owner(this.toRegion);
    }

    private isSameOwner(): boolean {
        return this.fromOwner === this.toOwner;
    }

    private applyPreemptiveDamage(attackSequence: AttackEvent[], fromList: { i: number }[]): number {
        const preemptiveDamage = Math.min(
            this.incomingSoldiers,
            this.state!.upgradeLevel(this.toOwner, 'DEFENSE') || 0
        );

        if (preemptiveDamage > 0) {
            this.recordPreemptiveDamage(preemptiveDamage, attackSequence, fromList);
            return preemptiveDamage;
        }
        return 0;
    }

    private applyFireDamage(attackSequence: AttackEvent[], toList: { i: number }[], runningAttackerCasualties: number): number {
        const fireDamage = Math.min(
            toList.length,
            this.state!.upgradeLevel(this.fromOwner, 'ATTACK') || 0
        );

        if (fireDamage > 0) {
            this.recordFireDamage(fireDamage, attackSequence, toList, runningAttackerCasualties);
            return fireDamage;
        }
        return 0;
    }

    private recordFireDamage(
        damage: number,
        attackSequence: AttackEvent[],
        toList: { i: number }[],
        runningAttackerCasualties: number
    ): void {
        // Remove soldiers from defending force
        for (let i = 0; i < damage && toList.length > 0; i++) {
            toList.pop();
        }

        attackSequence.push(this.eventFactory.createFireDamageEvent(damage, this.toRegion, runningAttackerCasualties));
    }

    private hasBothSidesWithForces(defendingSoldiers: number): boolean {
        return defendingSoldiers > 0 && this.incomingSoldiers > 0;
    }

    private canConquerUndefendedRegion(defendingSoldiers: number): boolean {
        return defendingSoldiers === 0 && this.incomingSoldiers > 0;
    }

    private resolveCombatWithOutcome(
        attackSequence: AttackEvent[],
        fromList: { i: number }[],
        toList: { i: number }[],
        defendingSoldiers: number,
        preemptiveCasualties: number,
        players: Player[]
    ): void {
        const didRetreat = this.recordFight(defendingSoldiers, attackSequence, fromList, toList, preemptiveCasualties, this.soldiers);

        if (didRetreat) {
            this.addRetreatOutcome(attackSequence, players);
        } else if (toList.length > 0) {
            this.addDefendedOutcome(attackSequence, players);
        } else {
            attackSequence.push(this.eventFactory.createConqueredEvent(this.toRegion));
        }
    }

    private addRetreatOutcome(attackSequence: AttackEvent[], players: Player[]): void {
        attackSequence.push(this.eventFactory.createRetreatEvent(this.fromRegion));
        this.addDefendedOutcome(attackSequence, players);
    }

    private addDefendedOutcome(attackSequence: AttackEvent[], players: Player[]): void {
        attackSequence.push(this.eventFactory.createDefendedEvent(this.toRegion, players, this.toOwner));
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
        attackSequence.push(this.eventFactory.createPreemptiveDamageEvent(damage, this.toRegion));
    }

    /**
     * Record the fight between attackers and defenders
     * Returns true if attackers retreated (lost >50% of initial force)
     * @param originalAttackerCount - The original number of attackers before preemptive damage
     */
    private recordFight(
        defendingSoldiers: number,
        attackSequence: AttackEvent[],
        fromList: { i: number }[],
        toList: { i: number }[],
        preemptiveCasualties: number = 0,
        originalAttackerCount: number = this.incomingSoldiers
    ): boolean {
        if (!this.state) return false;

        const retreatThreshold = this.calculateRetreatThreshold(originalAttackerCount);
        this.logCombatStart(defendingSoldiers, retreatThreshold);

        let attackersRemaining = this.incomingSoldiers;
        let defendersRemaining = defendingSoldiers;
        let totalAttackerCasualties = preemptiveCasualties;
        let totalDefenderCasualties = 0;

        if (this.shouldRetreatFromPreemptive(totalAttackerCasualties, retreatThreshold, attackersRemaining, defendersRemaining, originalAttackerCount)) {
            this.incomingSoldiers = attackersRemaining;
            return true;
        }

        while (attackersRemaining > 0 && defendersRemaining > 0) {
            const battleResult = this.battleRound.resolve(attackersRemaining, defendersRemaining);

            attackersRemaining -= battleResult.attackerCasualties;
            defendersRemaining -= battleResult.defenderCasualties;
            totalAttackerCasualties += battleResult.attackerCasualties;
            totalDefenderCasualties += battleResult.defenderCasualties;

            this.logBattleRound(battleResult, attackersRemaining, defendersRemaining);
            attackSequence.push(this.eventFactory.createBattleRoundEvent(battleResult, totalAttackerCasualties, totalDefenderCasualties));
            this.removeCasualtiesFromLists(fromList, toList, battleResult);

            if (this.shouldRetreat(totalAttackerCasualties, retreatThreshold, attackersRemaining, defendersRemaining, originalAttackerCount)) {
                this.incomingSoldiers = attackersRemaining;
                return true;
            }
        }

        this.incomingSoldiers = attackersRemaining;
        this.logBattleResult(attackersRemaining, defendersRemaining);
        return false;
    }

    private calculateRetreatThreshold(originalAttackerCount: number): number {
        return Math.floor(originalAttackerCount / 2);
    }

    private logCombatStart(defendingSoldiers: number, retreatThreshold: number): void {
        if (!this.isSimulation) {
            logger.debug(`🎲 Combat: ${this.incomingSoldiers} attackers vs ${defendingSoldiers} defenders (retreat if >${retreatThreshold} casualties)`);
        }
    }

    private shouldRetreatFromPreemptive(
        casualties: number,
        threshold: number,
        attackersRemaining: number,
        defendersRemaining: number,
        initialAttackers: number
    ): boolean {
        if (casualties > threshold && attackersRemaining > 0 && defendersRemaining > 0) {
            if (!this.isSimulation) {
                logger.debug(`🏃 Retreat triggered by preemptive damage! Casualties: ${casualties}/${initialAttackers}`);
            }
            return true;
        }
        return false;
    }

    private shouldRetreat(
        totalCasualties: number,
        threshold: number,
        attackersRemaining: number,
        defendersRemaining: number,
        initialAttackers: number
    ): boolean {
        if (totalCasualties > threshold && attackersRemaining > 0 && defendersRemaining > 0) {
            if (!this.isSimulation) {
                logger.debug(`🏃 Retreat! Attackers lost ${totalCasualties}/${initialAttackers} (>${threshold}). ${attackersRemaining} survivors retreating.`);
            }
            return true;
        }
        return false;
    }

    private logBattleRound(
        battleResult: { attackerCasualties: number; defenderCasualties: number },
        attackersRemaining: number,
        defendersRemaining: number
    ): void {
        if (!this.isSimulation) {
            logger.debug(`🎲 Battle round: A-${battleResult.attackerCasualties} D-${battleResult.defenderCasualties} | Remaining: A${attackersRemaining} D${defendersRemaining}`);
        }
    }

    private removeCasualtiesFromLists(
        fromList: { i: number }[],
        toList: { i: number }[],
        battleResult: { attackerCasualties: number; defenderCasualties: number }
    ): void {
        for (let i = 0; i < battleResult.attackerCasualties && fromList.length > 0; i++) {
            fromList.pop();
        }
        for (let i = 0; i < battleResult.defenderCasualties && toList.length > 0; i++) {
            toList.pop();
        }
    }

    private logBattleResult(attackersRemaining: number, defendersRemaining: number): void {
        if (!this.isSimulation) {
            const winner = defendersRemaining > 0 ? 'defender' : 'attacker';
            logger.debug(`Battle result: ${winner} wins! Final: A${attackersRemaining} D${defendersRemaining}`);
        }
    }
}
