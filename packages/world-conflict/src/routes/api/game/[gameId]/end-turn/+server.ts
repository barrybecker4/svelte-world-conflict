import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { EndTurnCommand, CommandProcessor, ArmyMoveCommand, BuildCommand } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { handleApiError } from '$lib/server/api-utils';
import { processAiTurns } from '$lib/server/ai/AiTurnProcessor';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { flushPendingUpdate } from '$lib/server/storage/PendingGameUpdates';

interface PendingMove {
    type: 'ARMY_MOVE' | 'BUILD';
    source?: number;
    destination?: number;
    count?: number;
    regionIndex?: number;
    upgradeIndex?: number;
}

interface EndTurnRequest {
    playerId: string;
    moves?: PendingMove[]; // Optional array of moves to process before ending turn
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId, moves = [] } = await request.json() as EndTurnRequest;

        if (!gameId) {
            return json({ error: 'Game ID is required' }, { status: 400 });
        }

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        console.log(`🔚 End turn request for game ${gameId} from player ${playerId} with ${moves.length} pending moves`);

        const gameStorage = GameStorage.create(platform!);

        // Flush any pending KV writes from this turn
        await flushPendingUpdate(gameId, gameStorage);

        // Load the current game
        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Parse playerId as integer to get player index
        const playerSlotIndex = parseInt(playerId);
        if (isNaN(playerSlotIndex) || playerSlotIndex < 0 || playerSlotIndex >= GAME_CONSTANTS.MAX_PLAYERS) {
            return json({ error: `Invalid player ID: ${playerId}` }, { status: 400 });
        }

        let gameState = new GameState(game.worldConflictState);

        const currentTurnPlayer = gameState.players.find(p => p.slotIndex === gameState.currentPlayerSlot);
        if (!currentTurnPlayer || currentTurnPlayer.slotIndex !== playerSlotIndex) {
            return json({ error: 'Not your turn' }, { status: 400 });
        }
        else {
          console.log(`currentTurnPlayer.slotIndex = ${currentTurnPlayer.slotIndex}, game.currentPlayerSlot = ${game.currentPlayerSlot}`);
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Process all pending moves first (if any)
        const commandProcessor = new CommandProcessor();
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            console.log(`📝 Processing pending move ${i + 1}/${moves.length}:`, move);

            let command;
            if (move.type === 'ARMY_MOVE') {
                if (move.source === undefined || move.destination === undefined || move.count === undefined) {
                    console.error('Invalid ARMY_MOVE - missing parameters:', move);
                    return json({ error: `Invalid move ${i + 1}: missing parameters` }, { status: 400 });
                }
                command = new ArmyMoveCommand(
                    gameState,
                    player,
                    move.source,
                    move.destination,
                    move.count
                );
            } else if (move.type === 'BUILD') {
                if (move.regionIndex === undefined || move.upgradeIndex === undefined) {
                    console.error('Invalid BUILD - missing parameters:', move);
                    return json({ error: `Invalid move ${i + 1}: missing parameters` }, { status: 400 });
                }
                command = new BuildCommand(
                    gameState,
                    player,
                    move.regionIndex,
                    move.upgradeIndex
                );
            } else {
                console.error('Unknown move type:', move.type);
                return json({ error: `Invalid move ${i + 1}: unknown type` }, { status: 400 });
            }

            // Process the command
            const moveResult = commandProcessor.process(command);
            if (!moveResult.success) {
                console.error(`Move ${i + 1} failed:`, moveResult.error);
                return json({ error: `Move ${i + 1} failed: ${moveResult.error}` }, { status: 400 });
            }

            // Update game state with the result
            gameState = moveResult.newState!;
            console.log(`✅ Move ${i + 1} processed successfully`);
        }

        // Now execute the end turn command
        const endTurnCommand = new EndTurnCommand(gameState, player);
        const result = commandProcessor.process(endTurnCommand);

        if (!result.success) {
            return json({ error: result.error || 'Failed to end turn' }, { status: 400 });
        }

        let finalGameState = result.newState!;

        // Check if next player is AI
        const nextPlayer = finalGameState.getCurrentPlayer();
        const isNextPlayerAi = nextPlayer?.isAI;

        if (isNextPlayerAi) {
            // If next player is AI, DON'T send WebSocket for human turn end
            // Just save the state and let AI processing send WebSockets
            console.log(`✅ Human turn ended, next player is AI (${nextPlayer.name}) - skipping turn end WebSocket`);

            // Save state but don't notify yet
            const updatedGame = {
                ...game,
                worldConflictState: finalGameState.toJSON(),
                currentPlayerSlot: finalGameState.currentPlayerSlot,
                lastMoveAt: Date.now(),
                lastAttackSequence: undefined // Clear attack sequence for turn end
            };
            await gameStorage.saveGame(updatedGame);

            // Process AI turns - each AI move will send its own WebSocket notification
            finalGameState = await processAiTurns(finalGameState, gameStorage, gameId, platform);
        } else {
            // Next player is human, send WebSocket for turn end
            console.log(`✅ Human turn ended, next player is human - sending turn end WebSocket`);
            const updatedGame = {
                ...game,
                worldConflictState: finalGameState.toJSON(),
                currentPlayerSlot: finalGameState.currentPlayerSlot,
                lastMoveAt: Date.now(),
                lastAttackSequence: undefined // Clear attack sequence for turn end
            };

            await gameStorage.saveGame(updatedGame);
            await WebSocketNotifications.gameUpdate(updatedGame);
        }

        console.log(`📊 Turn processing complete, final player slot: ${finalGameState.currentPlayerSlot}`);

        return json({
            success: true,
            gameState: finalGameState.toJSON(),
            message: 'Turn ended successfully',
            turnTransition: true
        });

    } catch (error) {
        return handleApiError(error, `ending turn in game ${params.gameId}`);
    }
};
