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

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.gameState.playerIndex !== this.player.index) {
      errors.push("It's not your turn");
    }

    if (this.gameState.movesRemaining === 0) {
      errors.push("You have no moves remaining");
    }

    // Check if game has already ended
    if (this.gameState.endResult) {
      errors.push("Game has already ended");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  execute(): GameState {
    this.previousState = this.gameState.copy();
    const newState = this.gameState.copy();

    // Calculate faith income from temples and regions
    this.calculateIncome(newState);

    // Add faith income to player
    if (this.income > 0) {
      const currentFaith = newState.faithByPlayer[this.player.index] || 0;
      newState.faithByPlayer[this.player.index] = currentFaith + this.income;

      // Add floating text for income display
      const playerTemples = this.getPlayerTemples(newState);
      if (playerTemples.length > 0) {
        newState.floatingText = [{
          regionIdx: playerTemples[0].regionIndex,
          text: `+${this.income}&#9775;`,
          color: '#fff',
          width: 5
        }];
      }
    }

    // Generate soldiers at temples
    this.generateSoldiersAtTemples(newState);

    // Reset moves for next turn
    newState.movesRemaining = GAME_CONSTANTS.BASE_MOVES_PER_TURN;

    // Clear conquered regions (reset for next turn)
    newState.conqueredRegions = [];

    // Advance to next player
    this.findNextPlayer(newState);

    // Increment turn index if we've cycled back to player 0
    if (newState.playerIndex === 0 && this.previousState.playerIndex !== 0) {
      newState.turnIndex += 1;
    }

    // Check if game should end due to turn limit or elimination
    const gameEndResult = checkGameEnd(newState.toJSON(), newState.players);
    if (gameEndResult.isGameEnded) {
      newState.endResult = gameEndResult.winner;
    }

    return newState;
  }

  private calculateIncome(state: GameState): void {
    let income = 0;

    // Faith from temples (base income)
    const playerTemples = this.getPlayerTemples(state);
    income += playerTemples.length * GAME_CONSTANTS.TEMPLE_INCOME_BASE;

    // Faith from regions owned
    const playerRegions = state.getRegionsOwnedByPlayer(this.player.index);
    income += playerRegions.length;

    // Faith from soldiers praying at temples
    playerTemples.forEach(temple => {
      const soldiers = state.soldiersAtRegion(temple.regionIndex);
      income += soldiers.length;
    });

    this.income = income;
  }

  private getPlayerTemples(state: GameState): any[] {
    // Get temples owned by this player
    return (state.temples || []).filter(temple =>
      state.ownersByRegion[temple.regionIndex] === this.player.index
    );
  }

  private generateSoldiersAtTemples(state: GameState): void {
    const playerTemples = this.getPlayerTemples(state);

    playerTemples.forEach(temple => {
      if (state.isOwnedBy(temple.regionIndex, this.player)) {
        state.addSoldiers(temple.regionIndex, GAME_CONSTANTS.SOLDIER_GENERATION_PER_TEMPLE);
        this.generatedSoldiers.push(temple.regionIndex);
      }
    });
  }

  private findNextPlayer(state: GameState): void {
    let attempts = 0;
    const maxAttempts = state.players.length;

    do {
      // Move to next player index
      state.playerIndex = (state.playerIndex + 1) % state.players.length;
      attempts++;

      // Safety check to prevent infinite loop
      if (attempts >= maxAttempts) {
        console.warn('Could not find next active player, game may need to end');
        break;
      }

      const nextPlayer = state.players[state.playerIndex];

      // Continue if this player has regions (is still alive)
      if (state.regionCount(nextPlayer) > 0) {
        break;
      }
    } while (attempts < maxAttempts);
  }

  undo(): void {
    if (!this.previousState) {
      throw new Error("Cannot undo - no previous state stored");
    }

    // Restore the previous state
    Object.assign(this.gameState, this.previousState);
  }

  serialize(): any {
    return {
      ...super.serialize(),
      type: 'END_TURN',
      income: this.income,
      generatedSoldiers: this.generatedSoldiers
    };
  }

  static deserialize(data: any, gameState: GameState, players: Player[]): EndTurnCommand {
    const player = players.find(p => p.index === data.playerIndex);
    if (!player) {
      throw new Error(`Player with index ${data.playerIndex} not found`);
    }

    const command = new EndTurnCommand(gameState, player);
    command.income = data.income || 0;
    command.generatedSoldiers = data.generatedSoldiers || [];

    return command;
  }
}
