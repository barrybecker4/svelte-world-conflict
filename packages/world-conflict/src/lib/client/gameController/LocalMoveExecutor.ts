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
        try {
            const gameState = new GameState(currentGameState);
            const player = gameState.getPlayerBySlotIndex(playerSlotIndex);

            if (!player) {
                return {
                    success: false,
                    error: `Player not found: ${playerSlotIndex}`
                };
            }

            const command = new ArmyMoveCommand(gameState, player, sourceRegion, targetRegion, soldierCount);

            const processor = new CommandProcessor();
            const result = processor.process(command);

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Move validation failed'
                };
            }

            return {
                success: true,
                gameState: result.newState!.toJSON(),
                attackSequence: result.attackSequence
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
