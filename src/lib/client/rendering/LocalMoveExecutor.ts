import { GameState } from '$lib/game/state/GameState';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import type { BattleMove, BattleResult } from '$lib/client/api/BattleApiClient';

/**
 * Executes moves locally using ArmyMoveCommand without server communication
 * Used for undo support and local-only game modes
 */
export class LocalMoveExecutor {
  /**
   * Execute move locally using ArmyMoveCommand
   */
  async execute(move: BattleMove, playerId: string): Promise<BattleResult> {
    const { sourceRegionIndex, targetRegionIndex, soldierCount } = move;

    console.log('💻 LocalMoveExecutor: Executing locally (no server call)');

    try {
      // Create GameState instance from the current game state data
      const gameState = GameState.fromJSON(move.gameState);

      // Find the player
      const playerSlotIndex = parseInt(playerId);
      const player = gameState.players.find(p => p.slotIndex === playerSlotIndex);

      if (!player) {
        throw new Error(`Player with slot index ${playerSlotIndex} not found`);
      }

      // Create and execute the ArmyMoveCommand
      const command = new ArmyMoveCommand(
        gameState,
        player,
        sourceRegionIndex,
        targetRegionIndex,
        soldierCount
      );

      // Validate the command
      const validation = command.validate();
      if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
      }

      // Execute the command to get the new state
      const newGameState = command.execute();
      const attackSequence = command.attackSequence;

      return {
        success: true,
        gameState: newGameState.toJSON(),
        attackSequence: attackSequence
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown local execution error';
      console.error('❌ LocalMoveExecutor: Local execution failed:', error);

      return {
        success: false,
        error: errorMessage
      };
    }
  }
}
