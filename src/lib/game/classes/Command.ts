import { AttackSequenceGenerator, type AttackEvent } from './AttackSequenceGenerator.ts';
import {
    type Player,
    type Soldier,
    WorldConflictGameState
} from "$lib/game/WorldConflictGameState.ts";
import type { Region } from '$lib/game/WorldConflictGameState.ts';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export abstract class Command {
    protected gameState: WorldConflictGameState;
    protected player: Player;
    protected timestamp: string;
    protected id: string;
    protected previousState?: WorldConflictGameState;

    constructor(gameState: WorldConflictGameState, player: Player) {
        this.gameState = gameState;
        this.player = player;
        this.timestamp = new Date().toISOString();
        this.id = this.generateId();
    }

    abstract validate(): ValidationResult;
    abstract execute(): WorldConflictGameState;
    abstract serialize(): any;

    protected generateId(): string {
        return `${this.gameState.id}-${this.player.index}-${Date.now()}`;
    }

    undo(): WorldConflictGameState {
        if (!this.previousState) {
            throw new Error("Cannot undo - no previous state stored");
        }
        return this.previousState;
    }
}

// ==================== ARMY MOVE COMMAND ====================

export class ArmyMoveCommand extends Command {
    public source: number;
    public destination: number;
    public count: number;
    public attackSequence?: AttackEvent[];

    constructor(
        gameState: WorldConflictGameState,
        player: Player,
        source: number,
        destination: number,
        count: number
    ) {
        super(gameState, player);
        this.source = source;
        this.destination = destination;
        this.count = count;
    }

    validate(): ValidationResult {
        const errors: string[] = [];

        if (!this.gameState.isOwnedBy(this.source, this.player)) {
            errors.push("You don't own the source region");
        }

        const availableSoldiers = this.gameState.soldierCount(this.source);
        if (this.count > availableSoldiers) {
            errors.push(`Only ${availableSoldiers} soldiers available`);
        }

        // Check if regions are neighbors (requires regions data)
        const regions = this.gameState.getRegions();
        const sourceRegion = regions.find((r: Region) => r.index === this.source);
        if (sourceRegion && !sourceRegion.neighbors.includes(this.destination)) {
            errors.push("Destination must be a neighboring region");
        }

        if (this.gameState.conqueredRegions?.includes(this.source)) {
            errors.push("Armies that conquered a region cannot move again this turn");
        }

        if (this.gameState.movesRemaining <= 0) {
            errors.push("No moves remaining");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    execute(): WorldConflictGameState {
      this.previousState = this.gameState.copy() as WorldConflictGameState;
      const newState = this.gameState.copy() as WorldConflictGameState;
      const players = newState.getPlayers();

      const targetSoldiers = newState.soldiersAtRegion(this.destination);
      const targetOwner = newState.owner(this.destination);

      // Generate attack sequence for any region with defenders that we don't own
      const needsCombat = targetSoldiers.length > 0 &&
                         (!targetOwner || targetOwner !== this.player);

      console.log('🎯 Combat check:', {
        destination: this.destination,
        targetSoldiers: targetSoldiers.length,
        targetOwner: targetOwner?.index || 'neutral',
        playerIndex: this.player.index,
        needsCombat
      });

      if (needsCombat) {
        const generator = new AttackSequenceGenerator({
          source: this.source,
          destination: this.destination,
          count: this.count
        });
        this.attackSequence = generator.createAttackSequenceIfFight(newState, players);

        console.log('⚔️ Generated attack sequence:', {
          hasSequence: !!this.attackSequence,
          sequenceLength: this.attackSequence?.length || 0
        });
      }

      this.executeMoveLogic(newState);
      return newState;
    }

    private executeMoveLogic(state: WorldConflictGameState): void {
        const fromList = state.soldiersAtRegion(this.source);
        const toList = state.soldiersAtRegion(this.destination);

        const wasEnemyRegion = !state.isOwnedBy(this.destination, this.player) && toList.length > 0;
        const wasNeutralRegion = !state.isOwnedBy(this.destination, this.player) && toList.length === 0;

        console.log('🎯 Move logic:', {
            destination: this.destination,
            wasEnemyRegion,
            wasNeutralRegion,
            toListBefore: toList.length,
            fromListBefore: fromList.length
        });

        if (this.attackSequence && this.attackSequence.length > 0) {
            this.handleCombatResult(state, fromList, toList);
        } else {
            // No combat needed - just move soldiers
            this.transferSoldiers(state, fromList, toList, this.count);
        }

        console.log('🎯 After combat/movement:', {
            toListAfter: toList.length,
            fromListAfter: fromList.length
        });

        // Check if we conquered the region (defenders eliminated or neutral)
        const conqueredRegion = (wasEnemyRegion && toList.length === 0) || wasNeutralRegion;

        if (conqueredRegion) {
            console.log('🏆 CONQUERING region', this.destination, 'for player', this.player.index);
            state.setOwner(this.destination, this.player);

            // Move remaining attackers to conquered region (only for enemy regions after combat)
            if (wasEnemyRegion && fromList.length > 0) {
                const attackersToMove = Math.min(this.count, fromList.length);
                this.transferSoldiers(state, fromList, toList, attackersToMove);
                console.log('🏆 Moved', attackersToMove, 'attackers to conquered region');
            }

            // Update conquered regions list
            if (!state.conqueredRegions) {
                state.conqueredRegions = [];
            }
            state.conqueredRegions.push(this.destination);
        }

        state.movesRemaining = Math.max(0, state.movesRemaining - 1);
    }

    // Apply attack sequence results
    private handleCombatResult(state: WorldConflictGameState, fromList: Soldier[], toList: Soldier[]): void {
        console.log('🔍 handleCombatResult - before combat:', {
            attackers: fromList.length,
            defenders: toList.length,
            hasAttackSequence: !!this.attackSequence
        });

        if (!this.attackSequence) return;

        // Apply combat results from attack sequence
        for (const event of this.attackSequence) {
            if (event.attackerCasualties && event.attackerCasualties > 0) {
                for (let i = 0; i < event.attackerCasualties && fromList.length > 0; i++) {
                    fromList.pop();
                }
            }

            if (event.defenderCasualties && event.defenderCasualties > 0) {
                for (let i = 0; i < event.defenderCasualties && toList.length > 0; i++) {
                    toList.pop();
                }
            }
        }

        console.log('🔍 handleCombatResult - after combat:', {
            attackers: fromList.length,
            defenders: toList.length,
            defendersEliminated: toList.length === 0
        });
    }

    private transferSoldiers(state: WorldConflictGameState, fromList: Soldier[], toList: Soldier[], count: number): void {
        const actualCount = Math.min(count, fromList.length);
        for (let i = 0; i < actualCount; i++) {
            const soldier = fromList.pop();
            if (soldier) {
                toList.push(soldier);
            }
        }
        console.log('🚶 Transferred', actualCount, 'soldiers');
    }

    serialize(): any {
        return {
            type: 'ArmyMoveCommand',
            playerId: this.player.index,
            source: this.source,
            destination: this.destination,
            count: this.count,
            timestamp: this.timestamp,
            id: this.id,
            attackSequence: this.attackSequence
        };
    }
}

// ==================== BUILD COMMAND ====================

export class BuildCommand extends Command {
    public regionIndex: number;
    public upgradeIndex: number;

    constructor(
        gameState: WorldConflictGameState,
        player: Player,
        regionIndex: number,
        upgradeIndex: number
    ) {
        super(gameState, player);
        this.regionIndex = regionIndex;
        this.upgradeIndex = upgradeIndex;
    }

    validate(): ValidationResult {
        const errors: string[] = [];

        if (!this.gameState.isOwnedBy(this.regionIndex, this.player)) {
            errors.push("You don't own this region");
        }

        const temple = this.gameState.temples[this.regionIndex];
        if (!temple) {
            errors.push("No temple at this region");
        }

        const cost = this.calculateCost();
        const playerCash = this.gameState.cash[this.player.index] || 0;
        if (cost > playerCash) {
            errors.push(`Need ${cost} faith, have ${playerCash}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    private calculateCost(): number {
        // Implementation depends on upgrade system
        // This is a simplified version - you may need to adjust based on your game rules
        const baseCosts = [0, 10, 25, 20, 30, 10]; // NONE, SOLDIER, AIR, DEFENSE, INCOME, REBUILD
        return baseCosts[this.upgradeIndex] || 0;
    }

    execute(): WorldConflictGameState {
        this.previousState = this.gameState.copy() as WorldConflictGameState;
        const newState = this.gameState.copy() as WorldConflictGameState;

        const cost = this.calculateCost();
        newState.cash[this.player.index] = (newState.cash[this.player.index] || 0) - cost;

        const temple = newState.temples[this.regionIndex];
        if (temple) {
            // Update temple based on upgrade type
            if (this.upgradeIndex === 1) { // SOLDIER upgrade
                // Buy soldier
                newState.numBoughtSoldiers = (newState.numBoughtSoldiers || 0) + 1;
                newState.addSoldiers(this.regionIndex, 1);
            } else if (this.upgradeIndex === 5) { // REBUILD upgrade
                // Rebuild temple
                temple.upgradeIndex = undefined;
                temple.level = 0;
            } else {
                // Other upgrades
                if (temple.upgradeIndex === this.upgradeIndex) {
                    temple.level = (temple.level || 0) + 1;
                } else {
                    temple.upgradeIndex = this.upgradeIndex;
                    temple.level = 0;
                }

                // Air upgrade gives extra move
                if (this.upgradeIndex === 2) { // AIR upgrade
                    newState.movesRemaining++;
                }
            }
        }

        return newState;
    }

    serialize(): any {
        return {
            type: 'BuildCommand',
            playerId: this.player.index,
            regionIndex: this.regionIndex,
            upgradeIndex: this.upgradeIndex,
            timestamp: this.timestamp,
            id: this.id
        };
    }
}

// ==================== END TURN COMMAND ====================

export class EndTurnCommand extends Command {
    private income: number = 0;
    private generatedSoldiers: number[] = [];

    constructor(gameState: WorldConflictGameState, player: Player) {
        super(gameState, player);
    }

    validate(): ValidationResult {
        const errors: string[] = [];

        const activePlayer = this.gameState.activePlayer();
        if (activePlayer.index !== this.player.index) {
            errors.push("Not your turn");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    execute(): WorldConflictGameState {
        console.log(`🔄 EndTurnCommand executing for player ${this.player.index} (${this.player.name})`);

        this.previousState = this.gameState.copy() as WorldConflictGameState;
        const newState = this.gameState.copy() as WorldConflictGameState;

        // BEFORE values for debugging
        const beforeCash = newState.cash[this.player.index] || 0;
        const beforeSoldiers = this.logTemplesSoldiers(newState, "BEFORE");

        // Calculate and add income (1 faith per region)
        this.income = this.calculateIncome(newState);
        newState.cash[this.player.index] = beforeCash + this.income;

        console.log(`💰 Faith income for player ${this.player.index}: ${beforeCash} + ${this.income} = ${newState.cash[this.player.index]}`);

        // Generate soldiers at temples
        this.generateSoldiersAtTemples(newState);

        // AFTER values for debugging
        const afterCash = newState.cash[this.player.index];
        const afterSoldiers = this.logTemplesSoldiers(newState, "AFTER");

        console.log(`📊 Summary for player ${this.player.index}:`);
        console.log(`   Faith: ${beforeCash} → ${afterCash} (+${this.income})`);
        console.log(`   Temples with soldiers added: ${this.generatedSoldiers.length}`);

        // Check for game end
        const gameEndResult = newState.checkGameEnd();
        if (gameEndResult) {
            newState.endResult = gameEndResult;
        }

        // Reset turn state
        newState.movesRemaining = 3;
        newState.numBoughtSoldiers = 0;
        newState.conqueredRegions = [];

        // Advance to next player
        const players = newState.getPlayers();
        newState.playerIndex = (newState.playerIndex + 1) % players.length;

        // If back to first player, increment turn
        if (newState.playerIndex === 0) {
            newState.turnIndex++;
        }

        console.log(`➡️  Turn advanced to player ${newState.playerIndex}`);
        console.log("✅ EndTurnCommand completed successfully");

        return newState;
    }

    private calculateIncome(state: WorldConflictGameState): number {
        // Simple income calculation: 1 faith per region owned
        const regionCount = state.regionCount(this.player);
        console.log(`🏛️  Player ${this.player.index} owns ${regionCount} regions`);
        return regionCount;
    }

    private generateSoldiersAtTemples(state: WorldConflictGameState): void {
        console.log(`🏛️  Checking temples for player ${this.player.index}:`);

        for (const [regionIndex, temple] of Object.entries(state.temples)) {
            const regionIdx = parseInt(regionIndex);
            if (state.isOwnedBy(regionIdx, this.player)) {
                const beforeSoldiers = state.soldiersByRegion[regionIdx]?.length || 0;

                // Each temple produces exactly 1 soldier after player's turn ends
                state.addSoldiers(regionIdx, 1);
                this.generatedSoldiers.push(regionIdx);

                const afterSoldiers = state.soldiersByRegion[regionIdx]?.length || 0;
                console.log(`   Region ${regionIdx}: ${beforeSoldiers} → ${afterSoldiers} soldiers (+1)`);
            }
        }

        if (this.generatedSoldiers.length === 0) {
            console.log(`   No temples owned by player ${this.player.index}`);
        }
    }

    private logTemplesSoldiers(state: WorldConflictGameState, phase: string): any {
        console.log(`🏛️  ${phase} - Temples and soldiers for player ${this.player.index}:`);
        const temples = [];

        for (const [regionIndex, temple] of Object.entries(state.temples)) {
            const regionIdx = parseInt(regionIndex);
            if (state.isOwnedBy(regionIdx, this.player)) {
                const soldiers = state.soldiersByRegion[regionIdx]?.length || 0;
                console.log(`   Region ${regionIdx}: ${soldiers} soldiers`);
                temples.push({ regionIdx, soldiers });
            }
        }

        return temples;
    }

    serialize(): any {
        return {
            type: 'EndTurnCommand',
            playerId: this.player.index,
            income: this.income,
            generatedSoldiers: this.generatedSoldiers,
            timestamp: this.timestamp,
            id: this.id
        };
    }
}

// ==================== COMMAND PROCESSOR ====================

export interface CommandResult {
    success: boolean;
    error?: string;
    newState?: WorldConflictGameState;
}

export class CommandProcessor {
    process(command: Command): CommandResult {
        try {
            // Validate command
            const validation = command.validate();
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }

            const newState = command.execute();
            return {
                success: true,
                newState
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
