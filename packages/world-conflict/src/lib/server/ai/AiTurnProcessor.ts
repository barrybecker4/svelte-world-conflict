/**
 * AI Turn Processing Utility
 * Handles AI turn processing logic for World Conflict
 *
 * This module provides reusable functions for processing AI turns
 * that can be used both during game creation and during normal gameplay.
 */
import { GameState } from '$lib/game/state/GameState';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { CommandProcessor, EndTurnCommand } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { pickAiMove } from './AiDecisionMaker';

/**
 * Process AI turns until we reach a human player or game ends
 * This function will continuously execute AI turns and update the game state
 * Sends individual WebSocket notifications for each AI action for real-time updates
 *
 * @param gameState - Current game state
 * @param gameStorage - Game storage instance for persistence
 * @param gameId - Game identifier for updates
 * @param platform - Platform context for WebSocket notifications
 * @returns Promise<GameState> - Updated game state after all AI turns
 */
export async function processAiTurns(gameState: GameState, gameStorage: GameStorage, gameId: string, platform: any): Promise<GameState> {
    let currentState = gameState;
    let currentPlayer = currentState.getCurrentPlayer();
    let turnCount = 0;
    const maxTurns = GAME_CONSTANTS.MAX_AI_TURNS; // Safety limit to prevent infinite loops
    let lastAttackSequence: any[] | undefined = undefined;

    console.log(`🤖 Processing AI turns for game ${gameId}, starting with ${currentPlayer?.name}`);
    console.log(`Starting AI turn processing - current player: ${currentPlayer?.name} (isAI: ${currentPlayer?.isAI})`);

    // Continue processing AI turns until we reach a human player or game ends
    while (currentPlayer?.isAI && !currentState.isGameComplete() && turnCount < maxTurns) {
        turnCount++;
        console.log(`Processing AI turn ${turnCount} for player ${currentPlayer.slotIndex} (${currentPlayer.name})`);

        try {
            // Generate AI move decision using sophisticated minimax AI
            const aiMove = await pickAiMove(currentPlayer, currentState);
            let moveMade = false;

            if (aiMove) {
                const commandProcessor = new CommandProcessor();
                const result = commandProcessor.process(aiMove);

                if (result.success && result.newState) {
                    currentState = result.newState;
                    moveMade = true;

                    // Store attack sequence for WebSocket notification
                    if (result.attackSequence) {
                        lastAttackSequence = result.attackSequence;
                        console.log(`💨 Stored attack sequence with ${result.attackSequence.length} events for battle replay`);
                    } else {
                        lastAttackSequence = undefined;
                    }

                    // Send WebSocket notification immediately for this move (but don't save to KV yet)
                    const updatedGame = await gameStorage.getGame(gameId);
                    if (updatedGame) {
                        updatedGame.worldConflictState = currentState.toJSON();
                        updatedGame.currentPlayerSlot = currentState.currentPlayerSlot;
                        updatedGame.lastMoveAt = Date.now();
                        updatedGame.lastAttackSequence = lastAttackSequence;

                        // Send WebSocket but DON'T save to KV
                        await WebSocketNotifications.gameUpdate(updatedGame);
                        console.log(`✅ AI move by ${currentPlayer.name} (${aiMove.constructor.name}) - WebSocket sent (KV save deferred)`);
                    }

                    // Small delay between AI actions for better UX
                    await new Promise(resolve => setTimeout(resolve, GAME_CONSTANTS.AI_ACTION_DELAY_MS));
                } else {
                    // Move failed - will end turn below
                    console.log(`AI move failed: ${result.error}. Will end turn.`);
                }
            }

            // If no move was made (either no move generated or move failed), end turn
            if (!moveMade) {
                console.log(`AI player ${currentPlayer.name} ending turn`);
                const endTurnCommand = new EndTurnCommand(currentState, currentPlayer);
                const commandProcessor = new CommandProcessor();
                const result = commandProcessor.process(endTurnCommand);

                if (result.success && result.newState) {
                    currentState = result.newState;
                    lastAttackSequence = undefined; // Clear attack sequence for turn end

                    // Send WebSocket notification for turn end (but don't save to KV yet)
                    const updatedGame = await gameStorage.getGame(gameId);
                    if (updatedGame) {
                        updatedGame.worldConflictState = currentState.toJSON();
                        updatedGame.currentPlayerSlot = currentState.currentPlayerSlot;
                        updatedGame.lastMoveAt = Date.now();
                        updatedGame.lastAttackSequence = undefined;

                        // Send WebSocket but DON'T save to KV
                        await WebSocketNotifications.gameUpdate(updatedGame);
                        console.log(`✅ AI ${currentPlayer.name} ended turn - WebSocket sent (KV save deferred)`);
                    }
                } else {
                    console.error('Failed to end AI turn:', result.error);
                    break;
                }
            }

            currentPlayer = currentState.getCurrentPlayer();

        } catch (error) {
            console.error('Error processing AI turn:', error);
            break;
        }
    }

    if (turnCount >= maxTurns) {
        console.warn(`AI processing stopped after ${maxTurns} turns to prevent infinite loop`);
    }

    const finalPlayer = currentState.getCurrentPlayer();
    console.log(`AI processing complete after ${turnCount} turns - current player: ${finalPlayer?.name} (isAI: ${finalPlayer?.isAI})`);

    // Save ONCE after all AI turns are complete
    const finalGame = await gameStorage.getGame(gameId);
    if (finalGame) {
        finalGame.worldConflictState = currentState.toJSON();
        finalGame.currentPlayerSlot = currentState.currentPlayerSlot;
        finalGame.lastMoveAt = Date.now();
        finalGame.lastAttackSequence = lastAttackSequence;

        await gameStorage.saveGame(finalGame);
        console.log(`💾 All AI turns complete - saved to KV (1 write for ${turnCount} AI actions)`);
    }

    return currentState;
}

