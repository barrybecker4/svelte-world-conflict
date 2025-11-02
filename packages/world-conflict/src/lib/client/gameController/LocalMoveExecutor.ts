import { GameState } from '$lib/game/state/GameState';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import { CommandProcessor } from '$lib/game/commands/CommandProcessor';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import type { BattleResult } from './GameApiClient';

/**
 * Executes moves locally on the client without sending to server
 * Moves are queued and sent to server only at turn end
 */
export class LocalMoveExecutor {
  /**
   * Execute an army move locally
   */
  executeArmyMove(
    currentGameState: GameStateData,
    playerSlotIndex: number,
    sourceRegion: number,
    targetRegion: number,
    soldierCount: number
  ): BattleResult {
    console.log('🏠 LocalMoveExecutor: Executing move locally', {
      source: sourceRegion,
      target: targetRegion,
      soldiers: soldierCount
    });

    try {
      // Convert GameStateData to GameState class
      const gameState = new GameState(currentGameState);
      
      // Get the player
      const player = gameState.getPlayerBySlotIndex(playerSlotIndex);
      if (!player) {
        throw new Error(`Player not found: ${playerSlotIndex}`);
      }

      // Create and execute the command
      const command = new ArmyMoveCommand(
        gameState,
        player,
        sourceRegion,
        targetRegion,
        soldierCount
      );

      const processor = new CommandProcessor();
      const result = processor.process(command);

      if (!result.success) {
        console.error('❌ LocalMoveExecutor: Command failed:', result.error);
        return {
          success: false,
          error: result.error || 'Move validation failed'
        };
      }

      // Convert result back to GameStateData
      const newGameStateData = result.newState!.toJSON();
      
      console.log('✅ LocalMoveExecutor: Move executed successfully');
      
      return {
        success: true,
        gameState: newGameStateData,
        attackSequence: result.attackSequence
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ LocalMoveExecutor: Execution failed:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

