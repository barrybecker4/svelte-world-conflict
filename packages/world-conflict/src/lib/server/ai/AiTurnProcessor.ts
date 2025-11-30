/**
 * AI Turn Processing Utility
 * Handles AI turn processing logic for World Conflict
 *
 * This module provides reusable functions for processing AI turns
 * that can be used both during game creation and during normal gameplay.
 */
import type { Player } from '$lib/game/state/GameState';
import { GameState } from '$lib/game/state/GameState';
import type { GameStorage, GameRecord } from '$lib/server/storage/GameStorage';
import type { Command } from '$lib/game/commands/Command';
import { CommandProcessor, EndTurnCommand } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { pickAiMove } from './AiDecisionMaker';
import { ArmyMoveCommand } from '$lib/game/commands/ArmyMoveCommand';
import { BuildCommand } from '$lib/game/commands/BuildCommand';
import { TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';
import { logger } from '$lib/game/utils/logger';

/** Metadata about a move for client animation */
interface MoveMetadata {
    type: 'army_move' | 'recruit' | 'upgrade' | 'end_turn';
    sourceRegion?: number;
    targetRegion?: number;
    soldierCount?: number;
}

/** Result from executing an AI move */
interface AiMoveResult {
    success: boolean;
    newState: GameState;
    attackSequence?: unknown[];
    moveMetadata?: MoveMetadata;
}

/**
 * Extract move metadata from AI command for animation purposes
 */
function extractMoveMetadata(command: Command): MoveMetadata | undefined {
    if (command instanceof ArmyMoveCommand) {
        return {
            type: 'army_move',
            sourceRegion: command.source,
            targetRegion: command.destination,
            soldierCount: command.count
        };
    } else if (command instanceof BuildCommand) {
        if (command.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.SOLDIER.index) {
            return { type: 'recruit', targetRegion: command.regionIndex };
        } else {
            return { type: 'upgrade', targetRegion: command.regionIndex };
        }
    } else if (command instanceof EndTurnCommand) {
        return { type: 'end_turn' };
    }
    return undefined;
}

/**
 * Execute a single AI move and process the result
 */
async function executeAiMove(
    currentState: GameState,
    currentPlayer: Player
): Promise<AiMoveResult> {
    const aiMove = await pickAiMove(currentPlayer, currentState);
    
    if (!aiMove) {
        return { success: false, newState: currentState };
    }

    const commandProcessor = new CommandProcessor();
    const result = commandProcessor.process(aiMove);

    if (result.success && result.newState) {
        return {
            success: true,
            newState: result.newState,
            attackSequence: result.attackSequence,
            moveMetadata: extractMoveMetadata(aiMove)
        };
    }

    logger.debug(`AI move failed: ${result.error}`);
    return { success: false, newState: currentState };
}

/**
 * End the current player's turn
 */
function endPlayerTurn(
    currentState: GameState,
    currentPlayer: Player
): AiMoveResult {
    const endTurnCommand = new EndTurnCommand(currentState, currentPlayer);
    const commandProcessor = new CommandProcessor();
    const result = commandProcessor.process(endTurnCommand);

    if (result.success && result.newState) {
        return {
            success: true,
            newState: result.newState,
            attackSequence: undefined,
            moveMetadata: extractMoveMetadata(endTurnCommand)
        };
    }

    logger.error('Failed to end AI turn:', result.error);
    return { success: false, newState: currentState };
}

/**
 * Send WebSocket notification for a game update
 */
async function notifyGameUpdate(
    gameStorage: GameStorage,
    gameId: string,
    currentState: GameState,
    moveMetadata: MoveMetadata | undefined,
    attackSequence: unknown[] | undefined
): Promise<void> {
    const game = await gameStorage.getGame(gameId);
    if (!game) return;

    game.worldConflictState = currentState.toJSON();
    game.currentPlayerSlot = currentState.currentPlayerSlot;
    game.lastMoveAt = Date.now();
    game.lastAttackSequence = attackSequence;
    game.lastMove = moveMetadata;

    await WebSocketNotifications.gameUpdate(game);
}

/**
 * Save final game state after all AI turns complete
 */
async function saveFinalGameState(
    gameStorage: GameStorage,
    gameId: string,
    currentState: GameState,
    lastMoveMetadata: MoveMetadata | undefined,
    lastAttackSequence: unknown[] | undefined
): Promise<void> {
    const finalGame = await gameStorage.getGame(gameId);
    if (!finalGame) return;

    finalGame.worldConflictState = currentState.toJSON();
    finalGame.currentPlayerSlot = currentState.currentPlayerSlot;
    finalGame.lastMoveAt = Date.now();
    finalGame.lastAttackSequence = lastAttackSequence;
    finalGame.lastMove = lastMoveMetadata;
    
    // Update status if game ended during AI turns
    if (currentState.endResult) {
        finalGame.status = 'COMPLETED';
        logger.info(`saveFinalGameState: Game ${gameId} ended during AI turns. endResult=${JSON.stringify(currentState.endResult)}, setting status=COMPLETED`);
    } else {
        logger.debug(`saveFinalGameState: Game ${gameId} continues. No endResult, status=${finalGame.status}`);
    }

    await gameStorage.saveGame(finalGame);
    logger.debug(`AI turns complete - saved to KV with status=${finalGame.status}`);
}

/**
 * Process AI turns until we reach a human player or game ends
 * This function will continuously execute AI turns and update the game state
 * Sends individual WebSocket notifications for each AI action for real-time updates
 *
 * @param gameState - Current game state
 * @param gameStorage - Game storage instance for persistence
 * @param gameId - Game identifier for updates
 * @param _platform - Platform context (unused, kept for API compatibility)
 * @returns Promise<GameState> - Updated game state after all AI turns
 */
export async function processAiTurns(
    gameState: GameState,
    gameStorage: GameStorage,
    gameId: string,
    _platform?: App.Platform
): Promise<GameState> {
    let currentState = gameState;
    let currentPlayer = currentState.getCurrentPlayer();
    let turnCount = 0;
    const maxTurns = GAME_CONSTANTS.MAX_AI_TURNS;
    let lastAttackSequence: unknown[] | undefined = undefined;
    let lastMoveMetadata: MoveMetadata | undefined = undefined;

    logger.debug(`Processing AI turns for game ${gameId}, starting with ${currentPlayer?.name}`);

    while (currentPlayer?.isAI && !currentState.isGameComplete() && turnCount < maxTurns) {
        turnCount++;

        try {
            const moveResult = await executeAiMove(currentState, currentPlayer);

            if (moveResult.success) {
                currentState = moveResult.newState;
                lastAttackSequence = moveResult.attackSequence;
                lastMoveMetadata = moveResult.moveMetadata;

                await notifyGameUpdate(
                    gameStorage,
                    gameId,
                    currentState,
                    moveResult.moveMetadata,
                    moveResult.attackSequence
                );

                // Small delay between AI actions for better UX
                await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.AI_ACTION_DELAY_MS));
            } else {
                // Move failed or no move available - end turn
                const endResult = endPlayerTurn(currentState, currentPlayer);
                
                if (!endResult.success) {
                    break;
                }

                currentState = endResult.newState;
                lastAttackSequence = undefined;
                lastMoveMetadata = endResult.moveMetadata;

                await notifyGameUpdate(
                    gameStorage,
                    gameId,
                    currentState,
                    endResult.moveMetadata,
                    undefined
                );
            }

            currentPlayer = currentState.getCurrentPlayer();

        } catch (error) {
            logger.error('Error processing AI turn:', error);
            break;
        }
    }

    if (turnCount >= maxTurns) {
        logger.warn(`AI processing stopped after ${maxTurns} turns to prevent infinite loop`);
    }

    await saveFinalGameState(
        gameStorage,
        gameId,
        currentState,
        lastMoveMetadata,
        lastAttackSequence
    );

    return currentState;
}
