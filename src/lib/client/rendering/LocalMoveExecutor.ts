import { GameState } from '$lib/game/state/GameState';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import type { BattleMove, BattleResult } from '$lib/client/gameController/GameApiClient';

/**
 * Executes moves locally using ArmyMoveCommand without server communication
 * Used for undo support and local-only game modes
 */
export class LocalMoveExecutor {
  /**
   * Execute move locally using ArmyMoveCommand
   */
  async execute(move: BattleMove, playerId: string): Promise<BattleResult> {
    console.log('💻 LocalMoveExecutor: Executing locally (no server call)');

    try {
      const gameState = GameState.fromJSON(move.gameState);
      const player = this.findPlayer(gameState, playerId);
      const command = this.createMoveCommand(move, gameState, player);
      
      this.validateCommand(command);
      
      return this.executeCommand(command);

    } catch (error) {
      return this.handleExecutionError(error);
    }
  }

  private findPlayer(gameState: GameState, playerId: string) {
    const playerSlotIndex = parseInt(playerId);
    const player = gameState.players.find(p => p.slotIndex === playerSlotIndex);

    if (!player) {
      throw new Error(`Player with slot index ${playerSlotIndex} not found`);
    }

    return player;
  }

  private createMoveCommand(move: BattleMove, gameState: GameState, player: any): ArmyMoveCommand {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    return new ArmyMoveCommand(
      gameState,
      player,
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount
    );
  }

  private validateCommand(command: ArmyMoveCommand): void {
    const validation = command.validate();
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }
  }

  private executeCommand(command: ArmyMoveCommand): BattleResult {
    const newGameState = command.execute();
    const attackSequence = command.attackSequence;

    return {
      success: true,
      gameState: newGameState.toJSON(),
      attackSequence: attackSequence
    };
  }

  private handleExecutionError(error: unknown): BattleResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown local execution error';
    console.error('❌ LocalMoveExecutor: Local execution failed:', error);

    return {
      success: false,
      error: errorMessage
    };
  }
}

