import { Command, type CommandValidationResult } from './Command';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { GameState, Player } from '$lib/game/state/GameState';

export class EndTurnCommand extends Command {
    private income: number = 0;
    private generatedSoldiers: number[] = [];

    constructor(gameState: GameState, player: Player) {
      super(gameState, player);
    }

    validate(): CommandValidationResult {
      const errors: string[] = [];

      const activePlayer = this.gameState.getCurrentPlayer();
      if (!activePlayer || activePlayer.slotIndex !== this.player.slotIndex) {
          errors.push("Not your turn");
      }

      return {
          valid: errors.length === 0,
          errors
      };
    }

    execute(): GameState {
        this.previousState = this.gameState;
        const newState = this.gameState.copy() as GameState;

        const beforeFaith = newState.state.faithByPlayer[this.player.slotIndex] || 0;
        const beforeSoldiers = this.getTemplesSoldiers(newState, "BEFORE");

        this.income = this.calculateIncome(newState);

        newState.state.faithByPlayer[this.player.slotIndex] = beforeFaith + this.income;
        newState.faithByPlayer[this.player.slotIndex] = beforeFaith + this.income;

        this.generateSoldiersAtTemples(newState);

        // Check if game should end due to turn limit or elimination
        const gameEndResult = checkGameEnd(newState.toJSON(), newState.players);
        if (gameEndResult.isGameEnded) {
            newState.endResult = gameEndResult.winner;
        }

        // Reset turn state
        newState.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;
        newState.numBoughtSoldiers = 0;
        newState.conqueredRegions = [];

        const players = newState.players;

        console.log('🔄 EndTurnCommand - Before turn advance:', {
          'currentPlayerSlotIndex': newState.currentPlayerSlot,
          'currentPlayerName': this.player.name,
          'players': players.map(p => ({
            slotIndex: p.slotIndex,
            name: p.name,
            isAI: p.isAI
          }))
        });

        const nextSlotIndex = this.getNextActiveSlot(newState.currentPlayerSlot, players);
        newState.currentPlayerSlot = nextSlotIndex;

        console.log('🔄 Turn advanced:', {
          'from': `${this.player.name} (slot ${this.player.slotIndex})`,
          'to': `${this.getPlayerBySlot(nextSlotIndex, players)?.name} (slot ${nextSlotIndex})`,
          'newPlayerSlotIndex': newState.currentPlayerSlot
        });

        // Check if we completed a full round (back to first active slot)
        const activeSlots = this.getActiveSlots(players);
        if (nextSlotIndex === activeSlots[0]) {
          newState.turnNumber++;
          console.log(`New turn: ${newState.turnNumber}`);
        }

        return newState;
    }

    private getNextActiveSlot(currentSlotIndex: number, players: Player[]): number {
        const activeSlots = this.getActiveSlots(players);
        const currentIndex = activeSlots.indexOf(currentSlotIndex);

        if (currentIndex === -1) {
            throw new Error(`Current slot ${currentSlotIndex} not found in active slots: ${JSON.stringify(activeSlots)}`);
        }

        const nextIndex = (currentIndex + 1) % activeSlots.length;
        return activeSlots[nextIndex];
    }

    private getActiveSlots(players: Player[]): number[] {
        return players.map(p => p.slotIndex).sort((a, b) => a - b);
    }

    private getPlayerBySlot(slotIndex: number, players: Player[]): Player | undefined {
        return players.find(p => p.slotIndex === slotIndex);
    }

    /**
     * Faith income rules:
     * 1. One faith for each region owned
     * 2. One faith for each soldier stationed at owned temples
     */
    private calculateIncome(state: GameState): number {
        const regionCount = state.regionCount(this.player);
        console.log(`Player ${this.player.slotIndex} owns ${regionCount} regions`);

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
                    console.log(`Player ${this.player.slotIndex} has ${soldiers.length} soldiers praying at temple region ${regionIdx}`);
                }
            }
        }

        const totalIncome = regionCount + soldiersAtTemples;
        console.log(`Player ${this.player.slotIndex} faith income: ${regionCount} regions + ${soldiersAtTemples} soldiers at temples = ${totalIncome} faith`);

        return totalIncome;
    }

    private generateSoldiersAtTemples(state: GameState): void {
        console.log(`Checking temples for player ${this.player.slotIndex}:`);

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
            console.log(`   No temples owned by player ${this.player.slotIndex}`);
        }
    }

    private getTemplesSoldiers(state: GameState, phase: string): Array<{ regionIdx: number, soldiers: number }> {
        const temples: Array<{ regionIdx: number, soldiers: number }> = [];

        for (const [regionIndex, temple] of Object.entries(state.templesByRegion)) {
            const regionIdx = parseInt(regionIndex);
            if (state.isOwnedBy(regionIdx, this.player)) {
                const soldiers = state.soldiersByRegion[regionIdx]?.length || 0;
                temples.push({ regionIdx, soldiers });
            }
        }

        return temples;
    }

    serialize(): any {
        return {
            type: 'EndTurnCommand',
            playerId: this.player.slotIndex,
            income: this.income,
            generatedSoldiers: this.generatedSoldiers,
            timestamp: this.timestamp,
            id: this.id
        };
    }
}
