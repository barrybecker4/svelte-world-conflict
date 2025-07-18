import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage,
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { ArmyMoveCommand, BuildCommand, EndTurnCommand, CommandProcessor } from '$lib/game/classes/Command.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';

interface MoveRequest {
    playerId: string;
    moveType: 'ARMY_MOVE' | 'BUILD' | 'END_TURN';

    // Army move specific
    source?: number;
    destination?: number;
    count?: number;

    // Build specific
    regionIndex?: number;
    upgradeIndex?: number;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const moveData = await request.json() as MoveRequest;

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Reconstruct World Conflict game state
        const worldConflictState = new WorldConflictGameState(game.worldConflictState);

        // Find player
        const player = worldConflictState.getPlayers().find(p => p.id === moveData.playerId);
        if (!player) {
            return json({ error: 'Player not found' }, { status: 404 });
        }

        // Create appropriate command
        let command;
        switch (moveData.moveType) {
            case 'ARMY_MOVE':
                if (moveData.source === undefined || moveData.destination === undefined || moveData.count === undefined) {
                    return json({ error: 'Missing army move parameters' }, { status: 400 });
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

            case 'END_TURN':
                command = new EndTurnCommand(worldConflictState, player);
                break;

            default:
                return json({ error: 'Invalid move type' }, { status: 400 });
        }

        // Process command
        const processor = new CommandProcessor();
        const result = processor.process(command);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        // Save updated game state
        const updatedGame = {
            ...game,
            worldConflictState: result.newState!.toJSON(),
            lastMoveAt: Date.now(),
            status: result.newState!.endResult ? 'COMPLETED' : 'ACTIVE'
        };

        await gameStorage.saveGame(updatedGame);

        // Send WebSocket updates
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        return json({
            success: true,
            gameState: result.newState!.toJSON(),
            command: command.serialize()
        });

    } catch (error) {
        console.error('Error in World Conflict move:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
