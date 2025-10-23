/**
 * AI Turn Processing Utility
 * Handles AI turn processing logic for World Conflict
 *
 * This module provides reusable functions for processing AI turns
 * that can be used both during game creation and during normal gameplay.
 */
import { GameState } from '$lib/game/state/GameState';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { ArmyMoveCommand, EndTurnCommand, CommandProcessor } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import type { Player } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

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

    console.log(`Starting AI turn processing - current player: ${currentPlayer?.name} (isAI: ${currentPlayer?.isAI})`);

    // Continue processing AI turns until we reach a human player or game ends
    while (currentPlayer?.isAI && !currentState.isGameComplete() && turnCount < maxTurns) {
        turnCount++;
        console.log(`Processing AI turn ${turnCount} for player ${currentPlayer.slotIndex} (${currentPlayer.name})`);

        try {
            // Generate AI move decision
            const aiMove = await generateAiMove(currentState, currentPlayer);
            let moveMade = false;

            if (aiMove) {
                const commandProcessor = new CommandProcessor();
                const result = commandProcessor.process(aiMove);

                if (result.success && result.newState) {
                    currentState = result.newState;
                    moveMade = true;

                    // Save game state after move
                    const updatedGame = await gameStorage.getGame(gameId);
                    if (updatedGame) {
                        updatedGame.worldConflictState = currentState.toJSON();
                        updatedGame.currentPlayerSlot = currentState.currentPlayerSlot;
                        updatedGame.lastMoveAt = Date.now();
                        
                        // Save attack sequence for battle replay
                        if (result.attackSequence) {
                            updatedGame.lastAttackSequence = result.attackSequence;
                            console.log(`💨 Saved attack sequence with ${result.attackSequence.length} events for battle replay`);
                        } else {
                            updatedGame.lastAttackSequence = undefined;
                        }
                        
                        await gameStorage.saveGame(updatedGame);

                        // Send WebSocket notification immediately for this move
                        await WebSocketNotifications.gameUpdate(updatedGame);
                        console.log(`✅ AI move by ${currentPlayer.name}: ${aiMove.count} soldiers from ${aiMove.source} to ${aiMove.destination} - WebSocket sent`);
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

                    // Save game state after ending turn
                    const updatedGame = await gameStorage.getGame(gameId);
                    if (updatedGame) {
                        updatedGame.worldConflictState = currentState.toJSON();
                        updatedGame.currentPlayerSlot = currentState.currentPlayerSlot;
                        updatedGame.lastMoveAt = Date.now();
                        
                        // Clear attack sequence for turn end (no battle)
                        updatedGame.lastAttackSequence = undefined;
                        
                        await gameStorage.saveGame(updatedGame);

                        // Send WebSocket notification for turn end
                        await WebSocketNotifications.gameUpdate(updatedGame);
                        console.log(`✅ AI ${currentPlayer.name} ended turn - WebSocket sent`);
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

    return currentState;
}

/**
 * Generate an AI move based on the current game state and player personality
 * This is a simplified AI that makes basic strategic decisions
 *
 * @param gameState - Current game state
 * @param player - AI player making the move
 * @returns Promise<Command | null> - AI command or null if no move possible
 */
export async function generateAiMove(gameState: GameState, player: Player): Promise<any> {
    // Check if AI has moves remaining
    const availableMoves = gameState.movesRemaining || 0;
    if (availableMoves <= 0) {
        return null; // No moves left, will end turn
    }

    try {
        // Get regions owned by this AI player
        const playerRegions = gameState.getRegionsOwnedByPlayer(player.slotIndex);

        if (playerRegions.length === 0) {
            console.log(`AI player ${player.name} has no regions`);
            return null;
        }

        // Find regions with soldiers that can move
        const regionsWithSoldiers = playerRegions.filter(region => {
            const soldierCount = gameState.soldierCount(region.index);
            return soldierCount > 0; // Need at least 1 soldier to move
        });

        if (regionsWithSoldiers.length === 0) {
            console.log(`AI player ${player.name} has no regions with movable soldiers`);
            return null;
        }

        // Pick a random region with soldiers
        const sourceRegion = regionsWithSoldiers[Math.floor(Math.random() * regionsWithSoldiers.length)];
        const neighbors = sourceRegion.neighbors || [];

        if (neighbors.length === 0) {
            console.log(`Source region ${sourceRegion.index} has no neighbors`);
            return null;
        }

        // Prioritize attacking enemy regions over moving to empty/friendly ones
        const enemyNeighbors = neighbors.filter(neighborIndex => {
            const owner = gameState.ownersByRegion[neighborIndex];
            return owner !== undefined && owner !== player.slotIndex;
        });

        const neutralNeighbors = neighbors.filter(neighborIndex => {
            const owner = gameState.ownersByRegion[neighborIndex];
            return owner === undefined;
        });

        // Choose target: prefer enemies > neutral > don't move to friendly
        let targetRegionIndex: number;
        if (enemyNeighbors.length > 0) {
            targetRegionIndex = enemyNeighbors[Math.floor(Math.random() * enemyNeighbors.length)];
        } else if (neutralNeighbors.length > 0) {
            targetRegionIndex = neutralNeighbors[Math.floor(Math.random() * neutralNeighbors.length)];
        } else {
            // All neighbors are friendly, skip this region
            return null;
        }

        // Determine how many soldiers to move (can move all soldiers now)
        const availableSoldiers = gameState.soldierCount(sourceRegion.index);
        const soldierCount = Math.min(
            availableSoldiers,
            Math.max(1, Math.floor(availableSoldiers * 0.7)) // Move up to 70% of available
        );

        if (soldierCount <= 0) {
            return null;
        }

        console.log(`AI ${player.name} moving ${soldierCount} soldiers from region ${sourceRegion.index} to region ${targetRegionIndex}`);

        // Create an army move command
        return new ArmyMoveCommand(
            gameState,
            player,
            sourceRegion.index,
            targetRegionIndex,
            soldierCount
        );

    } catch (error) {
        console.error('Error generating AI move:', error);
        return null;
    }
}
