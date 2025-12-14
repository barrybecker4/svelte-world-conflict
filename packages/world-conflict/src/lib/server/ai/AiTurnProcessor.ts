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
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { logger } from 'multiplayer-framework/shared';

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

/** Context for AI turn processing */
interface AiProcessingContext {
    gameStorage: GameStorage;
    gameId: string;
    currentState: GameState;
    lastAttackSequence: unknown[] | undefined;
    lastMoveMetadata: MoveMetadata | undefined;
}

/**
 * Check if game should end and set endResult if needed
 * Returns true if game ended
 */
function checkAndSetGameEnd(state: GameState): boolean {
    const gameEndCheck = checkGameEnd(state.toJSON(), state.players);
    if (gameEndCheck.isGameEnded && !state.endResult) {
        logger.info(`Game ended during AI move: ${gameEndCheck.reason}, winner: ${JSON.stringify(gameEndCheck.winner)}`);
        state.endResult = gameEndCheck.winner;
        return true;
    }
    return false;
}

/**
 * Process a successful AI move: update state, notify, check for game end
 * Returns true if processing should continue, false if game ended
 */
async function handleSuccessfulMove(
    ctx: AiProcessingContext,
    moveResult: AiMoveResult
): Promise<{ continueProcessing: boolean; updatedContext: AiProcessingContext }> {
    const updatedContext = {
        ...ctx,
        currentState: moveResult.newState,
        lastAttackSequence: moveResult.attackSequence,
        lastMoveMetadata: moveResult.moveMetadata
    };

    await notifyGameUpdate(
        ctx.gameStorage,
        ctx.gameId,
        updatedContext.currentState,
        moveResult.moveMetadata,
        moveResult.attackSequence
    );

    // Check if game ended after this move
    if (checkAndSetGameEnd(updatedContext.currentState)) {
        return { continueProcessing: false, updatedContext };
    }

    // Small delay between AI actions for better UX
    await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.AI_ACTION_DELAY_MS));
    
    return { continueProcessing: true, updatedContext };
}

/**
 * Handle when AI has no valid moves - end the turn
 * Returns true if processing should continue, false if turn end failed
 */
async function handleEndOfTurn(
    ctx: AiProcessingContext,
    currentPlayer: Player
): Promise<{ continueProcessing: boolean; updatedContext: AiProcessingContext }> {
    const endResult = endPlayerTurn(ctx.currentState, currentPlayer);
    
    if (!endResult.success) {
        return { continueProcessing: false, updatedContext: ctx };
    }

    const updatedContext = {
        ...ctx,
        currentState: endResult.newState,
        lastAttackSequence: undefined,
        lastMoveMetadata: endResult.moveMetadata
    };

    await notifyGameUpdate(
        ctx.gameStorage,
        ctx.gameId,
        updatedContext.currentState,
        endResult.moveMetadata,
        undefined
    );

    return { continueProcessing: true, updatedContext };
}

/**
 * Check if AI processing loop should continue
 */
function shouldContinueProcessing(
    currentPlayer: Player | undefined,
    state: GameState,
    turnCount: number,
    maxTurns: number
): boolean {
    return !!(currentPlayer?.isAI && !state.isGameComplete() && turnCount < maxTurns);
}

/**
 * Process AI turns until we reach a human player or game ends
 * Sends individual WebSocket notifications for each AI action for real-time updates
 */
export async function processAiTurns(
    gameState: GameState,
    gameStorage: GameStorage,
    gameId: string,
    _platform?: App.Platform
): Promise<GameState> {
    let ctx: AiProcessingContext = {
        gameStorage,
        gameId,
        currentState: gameState,
        lastAttackSequence: undefined,
        lastMoveMetadata: undefined
    };
    
    let currentPlayer = ctx.currentState.getCurrentPlayer();
    let turnCount = 0;
    const maxTurns = GAME_CONSTANTS.MAX_AI_TURNS;

    logger.debug(`Processing AI turns for game ${gameId}, starting with ${currentPlayer?.name}`);

    while (shouldContinueProcessing(currentPlayer, ctx.currentState, turnCount, maxTurns)) {
        turnCount++;

        try {
            const moveResult = await executeAiMove(ctx.currentState, currentPlayer!);

            if (moveResult.success) {
                const result = await handleSuccessfulMove(ctx, moveResult);
                ctx = result.updatedContext;
                if (!result.continueProcessing) break;
            } else {
                const result = await handleEndOfTurn(ctx, currentPlayer!);
                ctx = result.updatedContext;
                if (!result.continueProcessing) break;
            }

            currentPlayer = ctx.currentState.getCurrentPlayer();
        } catch (error) {
            logger.error('Error processing AI turn:', error);
            break;
        }
    }

    if (turnCount >= maxTurns) {
        logger.warn(`AI processing stopped after ${maxTurns} turns to prevent infinite loop`);
    }

    await saveFinalGameState(
        ctx.gameStorage,
        ctx.gameId,
        ctx.currentState,
        ctx.lastMoveMetadata,
        ctx.lastAttackSequence
    );

    return ctx.currentState;
}
