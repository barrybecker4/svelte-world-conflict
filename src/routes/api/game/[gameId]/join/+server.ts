import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/world-conflict/index.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player } from '$lib/game/types.ts';

interface JoinGameRequest {
    playerName: string;
}

/**
 * Helper function to safely get error message
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Generate a unique player ID
 */
function generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a proper World Conflict Player object
 */
function createPlayer(name: string, index: number): Player {
    const colors = [
        { start: '#dc2626', end: '#991b1b' }, // Red
        { start: '#2563eb', end: '#1d4ed8' }, // Blue
        { start: '#16a34a', end: '#15803d' }, // Green
        { start: '#ca8a04', end: '#a16207' }  // Yellow
    ];

    const color = colors[index % colors.length];

    return {
        index,
        name: name.trim(),
        color: color.start,
        isAI: false
    };
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerName } = await request.json() as JoinGameRequest;

        if (!playerName || !playerName.trim()) {
            return json({ error: 'Player name is required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game has already started' }, { status: 400 });
        }

        // Check if player name is already taken in this game
        if (game.players.some((p: Player) => p.name === playerName.trim())) {
            return json({ error: 'Player name already taken in this game' }, { status: 400 });
        }

        if (game.players.length >= 4) {
            return json({ error: 'Game is full' }, { status: 400 });
        }

        const newPlayer = createPlayer(playerName, game.players.length);
        const updatedPlayers = [...game.players, newPlayer];

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        // Check if game should start (has enough players)
        if (updatedPlayers.length >= 2) {
            updatedGame.status = 'ACTIVE';

            // Initialize World Conflict game state
            const gameState = WorldConflictGameState.createInitialState(
                gameId,
                updatedPlayers,
                game.worldConflictState.regions || []
            );

            updatedGame.worldConflictState = gameState.toJSON();
        }

        await gameStorage.saveGame(updatedGame);
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        return json({
            success: true,
            game: updatedGame,
            player: newPlayer,
            message: `${playerName} joined the game`
        });

    } catch (error) {
        console.error('❌ Failed to join game:', error);
        return json({ error: 'Failed to join game: ' + getErrorMessage(error) }, { status: 500 });
    }
};
