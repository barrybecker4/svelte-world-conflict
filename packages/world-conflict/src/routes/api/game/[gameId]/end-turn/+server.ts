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
import { logger } from '$lib/game/utils/logger';
import type { MoveMetadata } from '$lib/server/storage/types';

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

        logger.debug(`End turn request for game ${gameId} from player ${playerId} with ${moves.length} pending moves`);

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
          logger.debug(`currentTurnPlayer.slotIndex = ${currentTurnPlayer.slotIndex}, game.currentPlayerSlot = ${game.currentPlayerSlot}`);
        }

        // Verify the player exists in the game
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);
        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Process all pending moves first (if any)
        const commandProcessor = new CommandProcessor();
        let lastAttackSequence: any[] | undefined = undefined;
        const turnMoves: MoveMetadata[] = [];
        
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            logger.debug(`Processing pending move ${i + 1}/${moves.length}:`, move);

            let command;
            let moveMetadata: MoveMetadata | undefined;
            
            if (move.type === 'ARMY_MOVE') {
                if (move.source === undefined || move.destination === undefined || move.count === undefined) {
                    logger.error('Invalid ARMY_MOVE - missing parameters:', move);
                    return json({ error: `Invalid move ${i + 1}: missing parameters` }, { status: 400 });
                }
                command = new ArmyMoveCommand(
                    gameState,
                    player,
                    move.source,
                    move.destination,
                    move.count
                );
                moveMetadata = {
                    type: 'army_move',
                    sourceRegion: move.source,
                    targetRegion: move.destination,
                    soldierCount: move.count
                };
            } else if (move.type === 'BUILD') {
                if (move.regionIndex === undefined || move.upgradeIndex === undefined) {
                    logger.error('Invalid BUILD - missing parameters:', move);
                    return json({ error: `Invalid move ${i + 1}: missing parameters` }, { status: 400 });
                }
                command = new BuildCommand(
                    gameState,
                    player,
                    move.regionIndex,
                    move.upgradeIndex
                );
                moveMetadata = {
                    type: 'upgrade',
                    targetRegion: move.regionIndex
                };
            } else {
                logger.error('Unknown move type:', move.type);
                return json({ error: `Invalid move ${i + 1}: unknown type` }, { status: 400 });
            }

            // Process the command
            const moveResult = commandProcessor.process(command);
            if (!moveResult.success) {
                logger.error(`Move ${i + 1} failed:`, moveResult.error);
                return json({ error: `Move ${i + 1} failed: ${moveResult.error}` }, { status: 400 });
            }

            // Update game state with the result
            gameState = moveResult.newState!;
            
            // Capture attack sequence if this move generated one
            if (moveResult.attackSequence) {
                lastAttackSequence = moveResult.attackSequence;
                if (moveMetadata) {
                    moveMetadata.attackSequence = moveResult.attackSequence;
                }
                logger.debug(`Move ${i + 1} generated attack sequence with ${moveResult.attackSequence.length} events`);
            }
            
            // Add to turn moves for replay
            if (moveMetadata) {
                turnMoves.push(moveMetadata);
            }
            
            logger.debug(`Move ${i + 1} processed successfully`);
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

        logger.debug(`Turn ended - Next player is ${nextPlayer?.name} (AI: ${isNextPlayerAi}, movesRemaining: ${finalGameState.movesRemaining})`);

        // If next player is AI, process their turns immediately on the server
        if (isNextPlayerAi) {
            finalGameState = await processAiTurns(finalGameState, gameStorage, gameId, platform);
        }

        // Send WebSocket notification with move metadata for replay
        // This allows other players to see the correct animations
        const updatedGameWithSequence = {
            ...game,
            worldConflictState: finalGameState.toJSON(),
            currentPlayerSlot: finalGameState.currentPlayerSlot,
            lastMoveAt: Date.now(),
            lastAttackSequence, // Include attack sequence from the last move that generated one
            turnMoves: turnMoves.length > 0 ? turnMoves : undefined // Include all moves for sequential replay
        };
        
        if (turnMoves.length > 0) {
            logger.debug(`Sending WebSocket update with ${turnMoves.length} moves for replay`);
        }
        if (lastAttackSequence) {
            logger.debug(`Sending WebSocket update with attack sequence (${lastAttackSequence.length} events)`);
        }
        
        await WebSocketNotifications.gameUpdate(updatedGameWithSequence);

        // Now save to storage with replay data cleared (no need to persist it)
        const updatedGame = {
            ...updatedGameWithSequence,
            lastAttackSequence: undefined, // Clear for storage
            turnMoves: undefined // Clear for storage
        };
        await gameStorage.saveGame(updatedGame);

        logger.debug(`Turn processing complete, final player slot: ${finalGameState.currentPlayerSlot}`);

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
