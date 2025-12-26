import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState } from '$lib/game/state/GameState';
import { ArmyMoveCommand, BuildCommand, CommandProcessor } from '$lib/game/commands';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { handleApiError } from '$lib/server/api-utils';
import { getPendingUpdate, setPendingUpdate, clearPendingUpdate } from '$lib/server/storage/PendingGameUpdates';
import { logger } from 'multiplayer-framework/shared';

interface MoveRequest {
    playerId: string;
    moveType: 'ARMY_MOVE' | 'BUILD';

    // Army move specific
    source?: number;
    destination?: number;
    count?: number;

    // Build specific
    regionIndex?: number;
    upgradeIndex?: number;

    // Server-side batching flag
    deferKVWrite?: boolean;
}

/**
  * Handle player moves in World Conflict game
  * This endpoint processes player moves such as army movements, building, and ending turns.
  * It validates the move, applies the command, updates the game state, and sends notifications.
  * 
  * Server-side batching: If deferKVWrite is true, the game state is updated in memory
  * but not written to KV until endTurn is called.
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const moveData = await request.json() as MoveRequest;

        logger.debug(`Move request for game ${gameId}:`, moveData.moveType);

        const gameStorage = GameStorage.create(platform!);

        // Get the most recent game state (from pending updates if available, otherwise from KV)
        let game = getPendingUpdate(gameId);
        if (!game) {
            logger.debug(`No pending update, fetching from KV...`);
            game = await gameStorage.getGame(gameId) || undefined;
        } else {
            logger.debug(`Using pending update from memory`);
        }
        
        if (!game) {
            logger.debug(`Game ${gameId} not found`);
            return json({ error: 'Game not found' }, { status: 404 });
        }

        logger.debug(`Retrieved game state (currentPlayerSlot: ${game.currentPlayerSlot})`);

        // Reconstruct World Conflict game state
        const worldConflictState = new GameState(game.worldConflictState);

        // Find player by matching playerId with player index or name
        const playerIndex = parseInt(moveData.playerId);
        const player = worldConflictState.getPlayerBySlotIndex(playerIndex);

        if (!player) {
            return json({ error: 'Player not found' }, { status: 404 });
        }

        // Create appropriate command
        let command;
        switch (moveData.moveType) {
            case 'ARMY_MOVE':
                if (moveData.source === undefined || moveData.destination === undefined || moveData.count === undefined) {
                    return json({ error: 'Missing army move parameters', moveData }, { status: 400 });
                }
                command = new ArmyMoveCommand(
                    worldConflictState,
                    player,
                    moveData.source,
                    moveData.destination,
                    moveData.count
                );
                break;

            case 'BUILD':
                if (moveData.regionIndex === undefined || moveData.upgradeIndex === undefined) {
                    return json({ error: 'Missing build parameters' }, { status: 400 });
                }
                command = new BuildCommand(
                    worldConflictState,
                    player,
                    moveData.regionIndex,
                    moveData.upgradeIndex
                );
                break;

            default:
                return json({ error: 'Invalid move type: ' + moveData.moveType }, { status: 400 });
        }

        // Process command
        const processor = new CommandProcessor();
        const result = processor.process(command);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        // Determine proper status
        const gameStatus: 'ACTIVE' | 'COMPLETED' | 'PENDING' = result.newState!.endResult ? 'COMPLETED' : 'ACTIVE';

        // Get the resulting state
        const newStateJSON = result.newState!.toJSON();

        // Log ownership changes for debugging
        if (moveData.moveType === 'ARMY_MOVE' && moveData.destination !== undefined) {
            const oldOwner = game.worldConflictState.ownersByRegion?.[moveData.destination];
            const newOwner = newStateJSON.ownersByRegion?.[moveData.destination];
            logger.debug(`Region ${moveData.destination} ownership: ${oldOwner} → ${newOwner}`);
        }

        // Update game record
        const updatedGame: GameRecord = {
            ...game,
            worldConflictState: newStateJSON,
            lastMoveAt: Date.now(),
            status: gameStatus,
            lastAttackSequence: result.attackSequence // Store attack sequence for replay
        };

        // Server-side batching: defer KV write if requested
        if (moveData.deferKVWrite) {
            // Store in memory, don't write to KV yet
            setPendingUpdate(gameId, updatedGame);
        } else {
            // Write immediately
            await gameStorage.saveGame(updatedGame);
            clearPendingUpdate(gameId); // Clear any pending updates
        }

        // Send WebSocket updates - always send for real-time UI
        await WebSocketNotifications.gameUpdate(updatedGame);

        return json({
            success: true,
            gameState: result.newState!.toJSON(),
            game: updatedGame,
            message: 'Move processed successfully',
            attackSequence: result.attackSequence
        });

    } catch (error) {
        logger.error('Fatal error in move endpoint:', error);
        return handleApiError(error, `processing move for game ${params.gameId}`, {
            platform,
            gameId: params.gameId
        });
    }
};
