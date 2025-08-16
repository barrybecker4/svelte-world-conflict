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

        const isNeutralRegion = toList.length === 0 && !state.isOwnedBy(this.destination, this.player);

        if (this.attackSequence && this.attackSequence.length > 0) {
            this.handleCombatResult(state, fromList, toList);
        } else {
            this.transferSoldiers(state, fromList, toList, this.count);
        }

        if (isNeutralRegion) {
            console.log('🏆 CLAIMING neutral region', this.destination, 'for player', this.player.index);
            state.setOwner(this.destination, this.player);
        }

        // Update conquered regions
        if (!state.conqueredRegions) {
            state.conqueredRegions = [];
        }
        if (isNeutralRegion) {
            state.conqueredRegions.push(this.destination);
        }

        state.movesRemaining = Math.max(0, state.movesRemaining - 1);
    }

    private processCombat(
        state: WorldConflictGameState,
        fromList: { i: number }[],
        toList: { i: number }[]
    ): void {
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
                    toList.shift();
                }
            }
        }
    }

    // Apply attack sequence results
    private handleCombatResult(state: WorldConflictGameState, fromList: Soldier[], toList: Soldier[]): void {
        console.log('🔍 handleCombatResult - before combat:', {
            attackers: fromList.length,
            defenders: toList.length,
            destination: this.destination
        });

        if (this.attackSequence) {
            for (const event of this.attackSequence) {
                if (event.attackerCasualties) {
                    // Remove attacker casualties
                    for (let i = 0; i < event.attackerCasualties && fromList.length > 0; i++) {
                        fromList.pop();
                    }
                }
                if (event.defenderCasualties) {
                    // Remove defender casualties
                    for (let i = 0; i < event.defenderCasualties && toList.length > 0; i++) {
                        toList.pop();
                    }
                }
            }
        }

        // If defenders are eliminated, conquer the region
        if (toList.length === 0) {
            state.owners[this.destination] = this.player.index;
            // Move remaining attackers to conquered region
            this.transferSoldiers(state, fromList, toList, Math.min(this.count, fromList.length));
        }
    }

    private transferSoldiers(state: WorldConflictGameState, fromList: Soldier[], toList: Soldier[], count: number): void {
        const actualCount = Math.min(count, fromList.length);
        for (let i = 0; i < actualCount; i++) {
            const soldier = fromList.pop();
            if (soldier) {
                toList.push(soldier);
            }
        }
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
        this.previousState = this.gameState.copy() as WorldConflictGameState;
        const newState = this.gameState.copy() as WorldConflictGameState;

        // Calculate and add income
        this.income = this.calculateIncome(newState);
        newState.cash[this.player.index] = (newState.cash[this.player.index] || 0) + this.income;

        // Generate soldiers at temples
        this.generateSoldiersAtTemples(newState);

        // Check for game end
        const gameEndResult = newState.checkGameEnd();
        if (gameEndResult) {
            newState.endResult = gameEndResult;
        }

        // Reset turn state
        newState.movesRemaining = 3; // Default moves per turn
        newState.numBoughtSoldiers = 0;
        newState.conqueredRegions = [];

        // Advance to next player
        const players = newState.getPlayers();
        newState.playerIndex = (newState.playerIndex + 1) % players.length;

        // If back to first player, increment turn
        if (newState.playerIndex === 0) {
            newState.turnIndex++;
        }

        return newState;
    }

    private calculateIncome(state: WorldConflictGameState): number {
        // Basic income calculation - adjust based on your game rules
        const baseIncome = 5;
        const regionCount = state.regionCount(this.player);
        const incomePerRegion = 2;

        // Add temple income bonuses
        let templeBonus = 0;
        for (const [regionIndex, temple] of Object.entries(state.temples)) {
            const regionIdx = parseInt(regionIndex);
            if (state.isOwnedBy(regionIdx, this.player)) {
                // Income upgrade bonus (upgrade index 4)
                if (temple.upgradeIndex === 4) {
                    templeBonus += (temple.level || 0) * 3;
                }
            }
        }

        return baseIncome + (regionCount * incomePerRegion) + templeBonus;
    }

    private generateSoldiersAtTemples(state: WorldConflictGameState): void {
        for (const [regionIndex, temple] of Object.entries(state.temples)) {
            const regionIdx = parseInt(regionIndex);
            if (state.isOwnedBy(regionIdx, this.player)) {
                // Generate soldiers based on temple level and upgrade
                let soldiersToGenerate = 0;

                // Basic temple generation
                if (temple.level && temple.level > 0) {
                    soldiersToGenerate = 1;
                }

                // Soldier upgrade bonus (upgrade index 1)
                if (temple.upgradeIndex === 1) {
                    soldiersToGenerate += (temple.level || 0);
                }

                if (soldiersToGenerate > 0) {
                    state.addSoldiers(regionIdx, soldiersToGenerate);
                    this.generatedSoldiers.push(regionIdx);
                }
            }
        }
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
