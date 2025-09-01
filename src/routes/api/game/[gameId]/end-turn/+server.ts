import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/storage/GameStorage';
import { GameState } from '$lib/game/classes/GameState';
import { EndTurnCommand, CommandProcessor, ArmyMoveCommand, BuildCommand } from '$lib/game/classes/commands';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper';
import { getErrorMessage } from '$lib/server/api-utils';

interface EndTurnRequest {
    playerId: string;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId } = await request.json() as EndTurnRequest;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const gameStorage = GameStorage.create(platform!);

        // Load the current game
        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Parse playerId as integer to get player index
        const playerIndex = parseInt(playerId);
        if (isNaN(playerIndex) || playerIndex < 0 || playerIndex > 3) {
            return json({ error: `Invalid player ID: ${playerId}` }, { status: 400 });
        }

        // Verify it's the player's turn using player index
        if (game.currentPlayerIndex !== playerIndex) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.index === playerIndex);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Create game state instance
        const gameState = new GameState(game.worldConflictState);

        // Execute the human player's end turn command
        const endTurnCommand = new EndTurnCommand(gameState, player);
        const commandProcessor = new CommandProcessor();
        const result = commandProcessor.process(endTurnCommand);

        if (!result.success) {
            return json({ error: result.error || 'Failed to end turn' }, { status: 400 });
        }

        let finalGameState = result.newState!;

        // Process AI turns if the next player(s) are AI
        finalGameState = await processAiTurns(finalGameState, gameStorage, gameId, platform);

        // Update the game record with the final state
        const updatedGame = {
            ...game,
            worldConflictState: finalGameState.toJSON(),
            currentPlayerIndex: finalGameState.playerIndex,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        // Notify other players via WebSocket
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!.env);

        console.log(`Turn processing completed, current player: ${finalGameState.playerIndex}`);

        return json({
            success: true,
            gameState: finalGameState.toJSON(),
            message: 'Turn ended successfully',
            turnTransition: true
        });

    } catch (error) {
        console.error(`Error ending turn in game ${params.gameId}:`, error);
        return json({ error: 'Failed to end turn: ' + getErrorMessage(error) }, { status: 500 });
    }
};

/**
 * Process AI turns until we reach a human player or game ends
 */
async function processAiTurns(gameState: GameState, gameStorage: GameStorage, gameId: string, platform: any): Promise<GameState> {
    let currentState = gameState;
    let currentPlayer = currentState.activePlayer();

    // Continue processing AI turns until we reach a human player or game ends
    while (currentPlayer?.isAI && !currentState.isGameComplete()) {
        console.log(`Processing AI turn for player ${currentPlayer.index} (${currentPlayer.name})`);

        try {
            // Simulate AI move decision (you'll need to implement this based on your AI logic)
            const aiMove = await generateAiMove(currentState, currentPlayer);

            if (aiMove) {
                const commandProcessor = new CommandProcessor();
                const result = commandProcessor.process(aiMove);

                if (result.success && result.newState) {
                    currentState = result.newState;

                    // Save the updated game state
                    const updatedGame = {
                        ...await gameStorage.getGame(gameId),
                        worldConflictState: currentState.toJSON(),
                        currentPlayerIndex: currentState.playerIndex,
                        lastMoveAt: Date.now()
                    };

                    await gameStorage.saveGame(updatedGame);

                    // Notify players of AI move
                    await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform.env);

                    // Small delay to make AI moves visible
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.error('AI move failed:', result.error);
                    break;
                }
            } else {
                // AI couldn't make a move, end turn
                const endTurnCommand = new EndTurnCommand(currentState, currentPlayer);
                const commandProcessor = new CommandProcessor();
                const result = commandProcessor.process(endTurnCommand);

                if (result.success && result.newState) {
                    currentState = result.newState;
                } else {
                    break;
                }
            }

            currentPlayer = currentState.activePlayer();

        } catch (error) {
            console.error('Error processing AI turn:', error);
            break;
        }
    }

    return currentState;
}

/**
 * Generate an AI move based on the current game state and player personality
 * This is a simplified version - you'll need to implement the full AI logic
 */
async function generateAiMove(gameState: GameState, player: Player): Promise<any> {
    // This is where you'd implement the AI decision-making logic
    // Based on the project knowledge, this should mirror the erisk.aiPickMove function

    const availableMoves = gameState.movesRemaining || 0;
    if (availableMoves <= 0) {
        return null; // No moves left, will end turn
    }

    // Simple AI logic - find a region owned by this player with soldiers
    const playerRegions = gameState.getRegionsOwnedByPlayer(player.index);
    const regionsWithSoldiers = playerRegions.filter(region =>
        gameState.soldierCount(region.index) > 1
    );

    if (regionsWithSoldiers.length === 0) {
        return null; // No valid moves available
    }

    // Pick a random region with soldiers
    const sourceRegion = regionsWithSoldiers[Math.floor(Math.random() * regionsWithSoldiers.length)];
    const neighbors = sourceRegion.neighbors || [];

    if (neighbors.length === 0) {
        return null; // No neighbors to move to
    }

    // Pick a random neighbor
    const targetRegionIndex = neighbors[Math.floor(Math.random() * neighbors.length)];
    const soldierCount = Math.min(
        gameState.soldierCount(sourceRegion.index) - 1, // Leave one soldier
        1 // Move one soldier for now
    );

    if (soldierCount <= 0) {
        return null;
    }

    // Create an army move command
    return new ArmyMoveCommand(
        gameState,
        player,
        sourceRegion.index,
        targetRegionIndex,
        soldierCount
    );
}
