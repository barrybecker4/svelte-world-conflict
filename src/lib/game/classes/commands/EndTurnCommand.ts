import { Command } from './Command';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { checkGameEnd } from '$lib/game/logic/endGameLogic';
import type { GameState, Player } from '$lib/game/classes/GameState';

export class EndTurnCommand extends Command {
    private income: number = 0;
    private generatedSoldiers: number[] = [];

    constructor(gameState: GameState, player: Player) {
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

    execute(): GameState {
        this.previousState = this.gameState;
        const newState = this.gameState.copy() as GameState;;

        const beforeFaith = newState.state.faithByPlayer[this.player.index] || 0;
        const beforeSoldiers = this.logTemplesSoldiers(newState, "BEFORE");

        this.income = this.calculateIncome(newState);

        newState.state.faithByPlayer[this.player.index] = beforeFaith + this.income;
        newState.faithByPlayer[this.player.index] = beforeFaith + this.income;

        this.generateSoldiersAtTemples(newState);

        // Check if game should end due to turn limit or elimination
        const gameEndResult = checkGameEnd(newState.toJSON(), newState.players);
        if (gameEndResult.isGameEnded) {
            newState.endResult = gameEndResult.winner;
        }

        // Reset turn state
        newState.movesRemaining = 3;
        newState.numBoughtSoldiers = 0;
        newState.conqueredRegions = [];

        // Advance to next player
        const players = newState.players;
        newState.playerIndex = (newState.playerIndex + 1) % players.length;

        // If back to first player, increment turn
        if (newState.playerIndex === 0) {
            newState.turnIndex++;
        }

        return newState;
    }

    /**
     * Faith income rules:
     * 1. One faith for each region owned
     * 2. One faith for each soldier stationed at owned temples
     */
    private calculateIncome(state: GameState): number {
        const regionCount = state.regionCount(this.player);
        console.log(`Player ${this.player.index} owns ${regionCount} regions`);

        // Calculate soldiers praying at temples (soldiers stationed at temple regions owned by player)
        let soldiersAtTemples = 0;

        // Iterate through all regions to find owned temple regions
        for (const regionIndex in state.templesByRegion) {
            const regionIdx = parseInt(regionIndex);
            const temple = state.templesByRegion[regionIdx];

            // Check if player owns this temple region
            if (temple && state.isOwnedBy(regionIdx, this.player)) {
                // Count soldiers at this temple region
                const soldiers = state.soldiersByRegion[regionIdx];
                if (soldiers && soldiers.length > 0) {
                    // All soldiers at owned temple regions generate faith
                    soldiersAtTemples += soldiers.length;
                    console.log(`Player ${this.player.index} has ${soldiers.length} soldiers praying at temple region ${regionIdx}`);
                }
            }
        }

        const totalIncome = regionCount + soldiersAtTemples;
        console.log(`Player ${this.player.index} faith income: ${regionCount} regions + ${soldiersAtTemples} soldiers at temples = ${totalIncome} faith`);

        return totalIncome;
    }

    private generateSoldiersAtTemples(state: GameState): void {
        console.log(`Checking temples for player ${this.player.index}:`);

        for (const [regionIndex, temple] of Object.entries(state.templesByRegion)) {
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

    private logTemplesSoldiers(state: GameState, phase: string): any {
        console.log(`${phase} - Temples and soldiers for player ${this.player.index}:`);
        const temples = [];

        for (const [regionIndex, temple] of Object.entries(state.templesByRegion)) {
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
