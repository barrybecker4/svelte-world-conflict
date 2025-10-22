import { Command, type CommandValidationResult } from './Command';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { IncomeCalculator } from '$lib/game/mechanics/IncomeCalculator';
import type { GameState, Player } from '$lib/game/state/GameState';
import { Temple } from '$lib/game/entities/Temple';

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

        const beforeFaith = newState.getPlayerFaith(this.player.slotIndex);
     

        this.income = IncomeCalculator.calculateIncome(newState, this.player);

        newState.setPlayerFaith(this.player.slotIndex, beforeFaith + this.income);

        this.generateSoldiersAtTemples(newState);

        // Check if game should end due to turn limit or elimination
        const gameEndResult = checkGameEnd(newState.toJSON(), newState.players);
        if (gameEndResult.isGameEnded) {
            newState.endResult = gameEndResult.winner;
        }

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

        const nextSlotIndex = this.getNextActiveSlot(newState.currentPlayerSlot, players, newState);
        newState.currentPlayerSlot = nextSlotIndex;

        // Calculate moves for next player including Air temple bonuses
        const nextPlayer = this.getPlayerBySlot(nextSlotIndex, players);
        const airBonus = nextPlayer ? this.calculateAirBonus(newState, nextPlayer) : 0;
        
        // Reset turn state
        newState.movesRemaining = GAME_CONSTANTS.BASE_MOVES_PER_TURN + airBonus;
        newState.numBoughtSoldiers = 0;
        newState.conqueredRegions = [];
        newState.state.eliminatedPlayers = []; // Clear elimination events for next turn

        console.log('🔄 Turn advanced:', {
          'from': `${this.player.name} (slot ${this.player.slotIndex})`,
          'to': `${this.getPlayerBySlot(nextSlotIndex, players)?.name} (slot ${nextSlotIndex})`,
          'newPlayerSlotIndex': newState.currentPlayerSlot
        });

        // Check if we completed a full round (back to first active slot)
        const activeSlots = this.getActiveSlots(players, newState);
        if (nextSlotIndex === activeSlots[0]) {
          newState.turnNumber++;
          console.log(`New turn: ${newState.turnNumber}`);
        }

        return newState;
    }

    private getNextActiveSlot(currentSlotIndex: number, players: Player[], state: GameState): number {
        const activeSlots = this.getActiveSlots(players, state);
        const currentIndex = activeSlots.indexOf(currentSlotIndex);

        if (currentIndex === -1) {
            throw new Error(`Current slot ${currentSlotIndex} not found in active slots: ${JSON.stringify(activeSlots)}`);
        }

        const nextIndex = (currentIndex + 1) % activeSlots.length;
        return activeSlots[nextIndex];
    }

    private getActiveSlots(players: Player[], state: GameState): number[] {
        // Filter out eliminated players (players who own 0 regions)
        const activePlayers = players.filter(p => {
            const regionCount = Object.values(state.ownersByRegion).filter(
                owner => owner === p.slotIndex
            ).length;
            
            if (regionCount === 0) {
                console.log(`💀 Player ${p.name} (slot ${p.slotIndex}) is eliminated, skipping in turn order`);
            }
            
            return regionCount > 0;
        });
        
        const activeSlots = activePlayers.map(p => p.slotIndex).sort((a, b) => a - b);
        console.log(`🔄 Active player slots: ${JSON.stringify(activeSlots)} (${activePlayers.map(p => p.name).join(', ')})`);
        
        return activeSlots;
    }

    private getPlayerBySlot(slotIndex: number, players: Player[]): Player | undefined {
        return players.find(p => p.slotIndex === slotIndex);
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

    /**
     * Calculate total Air bonus (extra moves) from all temples owned by a player
     */
    private calculateAirBonus(state: GameState, player: Player): number {
        let totalAirBonus = 0;

        for (const [regionIndex, templeData] of Object.entries(state.templesByRegion)) {
            const regionIdx = parseInt(regionIndex);
            
            // Check if this temple is owned by the player
            if (state.ownersByRegion[regionIdx] === player.slotIndex) {
                const temple = Temple.deserialize(templeData);
                const airBonus = temple.getAirBonus();
                if (airBonus > 0) {
                    totalAirBonus += airBonus;
                    console.log(`Player ${player.slotIndex} has Air temple at region ${regionIdx} granting ${airBonus} extra move(s)`);
                }
            }
        }

        if (totalAirBonus > 0) {
            console.log(`Player ${player.slotIndex} total Air bonus: ${totalAirBonus} extra move(s)`);
        }

        return totalAirBonus;
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
