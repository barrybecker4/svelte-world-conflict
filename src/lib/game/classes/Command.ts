import type { GameState } from '../GameState.ts';
import type { Player } from '../types.ts';
import { AttackSequenceGenerator, type AttackEvent } from './AttackSequenceGenerator.ts';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export abstract class Command {
    protected gameState: GameState;
    protected player: Player;
    protected timestamp: string;
    protected id: string;
    protected previousState?: GameState;

    constructor(gameState: GameState, player: Player) {
        this.gameState = gameState;
        this.player = player;
        this.timestamp = new Date().toISOString();
        this.id = this.generateId();
    }

    abstract validate(): ValidationResult;
    abstract execute(): GameState;
    abstract serialize(): any;

    protected generateId(): string {
        return `${this.gameState.id}-${this.player.index}-${Date.now()}`;
    }

    undo(): GameState {
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
        gameState: GameState,
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
        const sourceRegion = regions.find(r => r.index === this.source);
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

    execute(): GameState {
        this.previousState = this.gameState.copy();
        const newState = this.gameState.copy();
        const players = newState.getPlayers();

        // Generate attack sequence if combat needed
        if (!newState.isOwnedBy(this.destination, this.player)) {
            const generator = new AttackSequenceGenerator({
                source: this.source,
                destination: this.destination,
                count: this.count
            });
            this.attackSequence = generator.createAttackSequenceIfFight(newState, players);
        }

        this.executeMoveLogic(newState);
        return newState;
    }

    private executeMoveLogic(state: GameState): void {
        const fromList = state.soldiersAtRegion(this.source);
        const toList = state.soldiersAtRegion(this.destination);

        // Process combat if there was an attack sequence
        if (this.attackSequence) {
            this.processCombat(state, fromList, toList);
        }

        // Move surviving soldiers
        const soldiersToMove = Math.min(this.count, fromList.length);
        for (let i = 0; i < soldiersToMove; i++) {
            const soldier = fromList.shift();
            if (soldier) {
                toList.push(soldier);
            }
        }

        // Update ownership if we conquered the region
        if (toList.length > 0 && fromList.length === 0) {
            state.owners[this.destination] = this.player.index;

            // Track conquered regions for this turn
            if (!state.conqueredRegions) {
                state.conqueredRegions = [];
            }
            state.conqueredRegions.push(this.destination);
        }

        // Use one move
        state.movesRemaining--;
    }

    private processCombat(state: GameState, fromList: any[], toList: any[]): void {
        if (!this.attackSequence) return;

        // Apply combat results from attack sequence
        for (const event of this.attackSequence) {
            if (event.attackerCasualties) {
                for (let i = 0; i < event.attackerCasualties; i++) {
                    fromList.shift();
                }
            }
            if (event.defenderCasualties) {
                for (let i = 0; i < event.defenderCasualties; i++) {
                    toList.shift();
                }
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
        gameState: GameState,
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
        // This is a simplified version
        const baseCosts = [0, 10, 25, 20, 30, 10]; // NONE, SOLDIER, AIR, DEFENSE, INCOME, REBUILD
        return baseCosts[this.upgradeIndex] || 0;
    }

    execute(): GameState {
        this.previousState = this.gameState.copy();
        const newState = this.gameState.copy();

        const cost = this.calculateCost();
        newState.cash[this.player.index] -= cost;

        const temple = newState.temples[this.regionIndex];

        if (this.upgradeIndex === 1) { // SOLDIER
            newState.addSoldiers(this.regionIndex, 1);
            newState.numBoughtSoldiers = (newState.numBoughtSoldiers || 0) + 1;
        } else if (this.upgradeIndex === 5) { // REBUILD
            temple.upgradeIndex = undefined;
            temple.level = 0;
        } else {
            // Apply temple upgrade
            if (temple.upgradeIndex === this.upgradeIndex) {
                temple.level = Math.min(temple.level + 1, 3);
            } else {
                temple.upgradeIndex = this.upgradeIndex;
                temple.level = 0;
            }

            // Air upgrade gives immediate move
            if (this.upgradeIndex === 2) { // AIR
                newState.movesRemaining++;
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

    validate(): ValidationResult {
        const errors: string[] = [];

        if (this.gameState.playerIndex !== this.player.index) {
            errors.push("Not your turn");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    execute(): GameState {
        this.previousState = this.gameState.copy();
        const newState = this.gameState.copy();
        const players = newState.getPlayers();

        // Calculate and apply income
        this.income = this.calculateIncome(newState);
        newState.cash[this.player.index] += this.income;

        // Generate soldiers at temples
        this.generateSoldiersAtTemples(newState);

        // Advance to next player
        newState.advanceToNextPlayer(players);

        // Check for game end
        if (newState.turnIndex > 100) { // Max turns
            newState.endResult = this.determineWinner(newState, players);
        }

        return newState;
    }

    private calculateIncome(state: GameState): number {
        let income = 0;

        // Base income per region
        const regionCount = state.regionCount(this.player);
        income += regionCount * 5;

        // Temple income bonuses
        const temples = state.templesForPlayer(this.player);
        for (const temple of temples) {
            if (temple.upgradeIndex === 4) { // INCOME upgrade
                const incomeBonus = [5, 10, 20][temple.level] || 0;
                income += incomeBonus;
            }
        }

        return income;
    }

    private generateSoldiersAtTemples(state: GameState): void {
        const temples = state.templesForPlayer(this.player);
        for (const temple of temples) {
            state.addSoldiers(temple.regionIndex, 1);
            this.generatedSoldiers.push(temple.regionIndex);
        }
    }

    private determineWinner(state: GameState, players: Player[]): Player | 'DRAWN_GAME' {
        const scores = players.map(player => ({
            player,
            score: state.regionCount(player) * 1000 + state.totalSoldiers(player)
        }));

        scores.sort((a, b) => b.score - a.score);

        return scores[0].score > scores[1]?.score ? scores[0].player : 'DRAWN_GAME';
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

export class CommandProcessor {
    process(command: Command): { success: boolean; newState?: GameState; error?: string } {
        try {
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
