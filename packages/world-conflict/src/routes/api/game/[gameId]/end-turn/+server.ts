import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState, type Player } from '$lib/game/state/GameState';
import { EndTurnCommand, CommandProcessor, ArmyMoveCommand, BuildCommand, type Command } from '$lib/game/commands';
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
    moves?: PendingMove[];
}

interface ProcessedMoves {
    gameState: GameState;
    lastAttackSequence: unknown[] | undefined;
    turnMoves: MoveMetadata[];
}

interface ValidationResult {
    error?: { message: string; status: number };
    game?: GameRecord;
    player?: Player;
    playerSlotIndex?: number;
}

/**
 * Validate the end turn request parameters
 */
function validateRequest(gameId: string | undefined, playerId: string | undefined): { error?: string } {
    if (!gameId) {
        return { error: 'Game ID is required' };
    }
    if (!playerId) {
        return { error: 'Player ID is required' };
    }
    return {};
}

/**
 * Parse and validate player ID
 */
function parsePlayerId(playerId: string): { playerSlotIndex?: number; error?: string } {
    const playerSlotIndex = parseInt(playerId);
    if (isNaN(playerSlotIndex) || playerSlotIndex < 0 || playerSlotIndex >= GAME_CONSTANTS.MAX_PLAYERS) {
        return { error: `Invalid player ID: ${playerId}` };
    }
    return { playerSlotIndex };
}

/**
 * Validate that it's the player's turn and they can end it
 */
function validatePlayerTurn(
    game: GameRecord,
    gameState: GameState,
    playerSlotIndex: number
): ValidationResult {
    const currentTurnPlayer = gameState.players.find(p => p.slotIndex === gameState.currentPlayerSlot);
    if (!currentTurnPlayer || currentTurnPlayer.slotIndex !== playerSlotIndex) {
        return { error: { message: 'Not your turn', status: 400 } };
    }

    logger.debug(`currentTurnPlayer.slotIndex = ${currentTurnPlayer.slotIndex}, game.currentPlayerSlot = ${game.currentPlayerSlot}`);

    const player = game.players.find(p => p.slotIndex === playerSlotIndex);
    if (!player) {
        return { error: { message: 'Player not found in game', status: 400 } };
    }

    return { game, player, playerSlotIndex };
}

/**
 * Create a command from a pending move
 */
function createMoveCommand(
    move: PendingMove,
    moveIndex: number,
    gameState: GameState,
    player: Player
): { command?: Command; metadata?: MoveMetadata; error?: string } {
    if (move.type === 'ARMY_MOVE') {
        if (move.source === undefined || move.destination === undefined || move.count === undefined) {
            logger.error('Invalid ARMY_MOVE - missing parameters:', move);
            return { error: `Invalid move ${moveIndex + 1}: missing parameters` };
        }
        return {
            command: new ArmyMoveCommand(gameState, player, move.source, move.destination, move.count),
            metadata: {
                type: 'army_move',
                sourceRegion: move.source,
                targetRegion: move.destination,
                soldierCount: move.count
            }
        };
    }

    if (move.type === 'BUILD') {
        if (move.regionIndex === undefined || move.upgradeIndex === undefined) {
            logger.error('Invalid BUILD - missing parameters:', move);
            return { error: `Invalid move ${moveIndex + 1}: missing parameters` };
        }
        return {
            command: new BuildCommand(gameState, player, move.regionIndex, move.upgradeIndex),
            metadata: {
                type: 'upgrade',
                targetRegion: move.regionIndex
            }
        };
    }

    logger.error('Unknown move type:', move.type);
    return { error: `Invalid move ${moveIndex + 1}: unknown type` };
}

/**
 * Process all pending moves before ending the turn
 */
function processPendingMoves(
    moves: PendingMove[],
    initialGameState: GameState,
    player: Player,
    commandProcessor: CommandProcessor
): { result?: ProcessedMoves; error?: { message: string; status: number } } {
    let gameState = initialGameState;
    let lastAttackSequence: unknown[] | undefined;
    const turnMoves: MoveMetadata[] = [];

    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        logger.debug(`Processing pending move ${i + 1}/${moves.length}:`, move);

        const { command, metadata, error } = createMoveCommand(move, i, gameState, player);
        if (error || !command) {
            return { error: { message: error!, status: 400 } };
        }

        const moveResult = commandProcessor.process(command);
        if (!moveResult.success) {
            logger.error(`Move ${i + 1} failed:`, moveResult.error);
            return { error: { message: `Move ${i + 1} failed: ${moveResult.error}`, status: 400 } };
        }

        gameState = moveResult.newState!;

        if (moveResult.attackSequence) {
            lastAttackSequence = moveResult.attackSequence;
            if (metadata) {
                metadata.attackSequence = moveResult.attackSequence;
            }
            logger.debug(`Move ${i + 1} generated attack sequence with ${moveResult.attackSequence.length} events`);
        }

        if (metadata) {
            turnMoves.push(metadata);
        }

        logger.debug(`Move ${i + 1} processed successfully`);
    }

    return { result: { gameState, lastAttackSequence, turnMoves } };
}

/**
 * Execute the end turn command and process AI turns if needed
 */
async function executeEndTurn(
    gameState: GameState,
    player: Player,
    gameStorage: GameStorage,
    gameId: string,
    platform: App.Platform | undefined,
    commandProcessor: CommandProcessor
): Promise<{ finalState?: GameState; error?: { message: string; status: number } }> {
    const endTurnCommand = new EndTurnCommand(gameState, player);
    const result = commandProcessor.process(endTurnCommand);

    if (!result.success) {
        return { error: { message: result.error || 'Failed to end turn', status: 400 } };
    }

    let finalGameState = result.newState!;

    const nextPlayer = finalGameState.getCurrentPlayer();
    const isNextPlayerAi = nextPlayer?.isAI;

    logger.debug(`Turn ended - Next player is ${nextPlayer?.name} (AI: ${isNextPlayerAi}, movesRemaining: ${finalGameState.movesRemaining})`);

    if (isNextPlayerAi) {
        finalGameState = await processAiTurns(finalGameState, gameStorage, gameId, platform);
    }

    return { finalState: finalGameState };
}

/**
 * Build the updated game record for broadcasting and storage
 */
function buildUpdatedGame(
    game: GameRecord,
    finalGameState: GameState,
    lastAttackSequence: unknown[] | undefined,
    turnMoves: MoveMetadata[]
): GameRecord {
    const endResult = finalGameState.endResult;
    const gameStatus: 'ACTIVE' | 'COMPLETED' = endResult ? 'COMPLETED' : 'ACTIVE';
    
    logger.info(`buildUpdatedGame: gameId=${game.gameId}, endResult=${JSON.stringify(endResult)}, gameStatus=${gameStatus}`);

    return {
        ...game,
        status: gameStatus,
        worldConflictState: finalGameState.toJSON(),
        currentPlayerSlot: finalGameState.currentPlayerSlot,
        lastMoveAt: Date.now(),
        lastAttackSequence,
        turnMoves: turnMoves.length > 0 ? turnMoves : undefined
    };
}

/**
 * Broadcast game update via WebSocket and save to storage
 */
async function broadcastAndSave(
    updatedGame: GameRecord,
    gameStorage: GameStorage
): Promise<void> {
    if (updatedGame.turnMoves && updatedGame.turnMoves.length > 0) {
        logger.debug(`Sending WebSocket update with ${updatedGame.turnMoves.length} moves for replay`);
    }
    if (updatedGame.lastAttackSequence) {
        logger.debug(`Sending WebSocket update with attack sequence (${(updatedGame.lastAttackSequence as unknown[]).length} events)`);
    }

    await WebSocketNotifications.gameUpdate(updatedGame);

    // Save to storage with replay data cleared (no need to persist it)
    const gameForStorage = {
        ...updatedGame,
        lastAttackSequence: undefined,
        turnMoves: undefined
    };
    await gameStorage.saveGame(gameForStorage);
}

/**
 * Handle player end turn request
 * Processes any pending moves, executes the end turn, handles AI turns, and saves the result
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId, moves = [] } = await request.json() as EndTurnRequest;

        // Validate request
        const validation = validateRequest(gameId, playerId);
        if (validation.error) {
            return json({ error: validation.error }, { status: 400 });
        }

        logger.debug(`End turn request for game ${gameId} from player ${playerId} with ${moves.length} pending moves`);

        // Load game
        const gameStorage = GameStorage.create(platform!);
        await flushPendingUpdate(gameId!, gameStorage);

        const game = await gameStorage.getGame(gameId!);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Validate player
        const { playerSlotIndex, error: playerError } = parsePlayerId(playerId!);
        if (playerError) {
            return json({ error: playerError }, { status: 400 });
        }

        const gameState = new GameState(game.worldConflictState);
        const turnValidation = validatePlayerTurn(game, gameState, playerSlotIndex!);
        if (turnValidation.error) {
            return json({ error: turnValidation.error.message }, { status: turnValidation.error.status });
        }

        const player = turnValidation.player!;
        const commandProcessor = new CommandProcessor();

        // Process pending moves
        const movesResult = processPendingMoves(moves, gameState, player, commandProcessor);
        if (movesResult.error) {
            return json({ error: movesResult.error.message }, { status: movesResult.error.status });
        }

        const { gameState: stateAfterMoves, lastAttackSequence, turnMoves } = movesResult.result!;

        // Execute end turn and AI processing
        const endTurnResult = await executeEndTurn(
            stateAfterMoves,
            player,
            gameStorage,
            gameId!,
            platform,
            commandProcessor
        );
        if (endTurnResult.error) {
            return json({ error: endTurnResult.error.message }, { status: endTurnResult.error.status });
        }

        const finalGameState = endTurnResult.finalState!;

        // Build updated game and broadcast/save
        const updatedGame = buildUpdatedGame(game, finalGameState, lastAttackSequence, turnMoves);
        await broadcastAndSave(updatedGame, gameStorage);

        logger.debug(`Turn processing complete, final player slot: ${finalGameState.currentPlayerSlot}`);

        return json({
            success: true,
            gameState: finalGameState.toJSON(),
            message: 'Turn ended successfully',
            turnTransition: true
        });

    } catch (error) {
        return handleApiError(error, `ending turn in game ${params.gameId}`, {
            platform,
            gameId: params.gameId
        });
    }
};
