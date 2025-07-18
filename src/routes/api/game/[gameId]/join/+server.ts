import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import { kvGetJSON, kvPutJSON, isUsingRealKV } from '$lib/server/kv.ts';
import { WorldConflictGameState } from '$lib/game/WorldConflictGameState.ts';

interface JoinGameRequest {
    playerName: string;
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerName } = await request.json() as JoinGameRequest;

        console.log(`🤝 JOIN GAME: "${playerName}" trying to join ${gameId}`);
        console.log('📦 KV Available:', isUsingRealKV(platform));

        if (!playerName?.trim()) {
            return json({ error: 'Player name required' }, { status: 400 });
        }

        // Get the current game state using fallback KV
        const game = await kvGetJSON(platform, `wc_game:${gameId}`);

        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'WAITING') {
            return json({ error: 'Game is no longer accepting players' }, { status: 400 });
        }

        if (game.players.length >= 4) {
            return json({ error: 'Game is full' }, { status: 400 });
        }

        // Check if player name is already taken in this game
        if (game.players.some(p => p.name === playerName.trim())) {
            return json({ error: 'Player name already taken in this game' }, { status: 400 });
        }

        // Add the new player
        const newPlayerId = generatePlayerId();
        const newPlayerIndex = game.players.length;

        const newPlayer = {
            id: newPlayerId,
            name: playerName.trim(),
            index: newPlayerIndex
        };

        const updatedPlayers = [...game.players, newPlayer];

        // Update game status if we now have enough players (2+)
        const newStatus = updatedPlayers.length >= 2 ? 'ACTIVE' : 'WAITING';

        // Update the game data
        const updatedGame = {
            ...game,
            players: updatedPlayers,
            status: newStatus,
            lastActivity: Date.now()
        };

        // If game is now active, we need to update the World Conflict game state
        if (newStatus === 'ACTIVE' && game.worldConflictState) {
            try {
                // Recreate the game state with all players
                const allPlayers = updatedPlayers.map(p => ({
                    id: p.id,
                    name: p.name,
                    index: p.index
                }));

                const worldConflictState = WorldConflictGameState.createInitialState(
                    gameId,
                    allPlayers,
                    game.worldConflictState.regions || []
                );

                updatedGame.worldConflictState = worldConflictState.toJSON();
            } catch (stateError) {
                console.warn('Failed to update World Conflict state:', stateError);
                // Continue with game join even if state update fails
            }
        }

        // Save the updated game using fallback KV
        await kvPutJSON(platform, `wc_game:${gameId}`, updatedGame);

        console.log(`🎮 PLAYER JOINED: "${playerName}" joined game ${gameId}`);
        console.log(`   Players: ${updatedPlayers.map(p => p.name).join(', ')}`);
        console.log(`   Status: ${newStatus}`);

        // Send WebSocket notification about player joining (only in production with correct format)
        if (isUsingRealKV(platform)) {
            try {
                // WebSocket notifications only work in production with proper setup
                console.log('📡 WebSocket notifications available in production');
                // TODO: Update WebSocketNotificationHelper for World Conflict format
            } catch (wsError) {
                console.warn('WebSocket notification failed:', wsError);
            }
        } else {
            console.log('📡 WebSocket notifications disabled in development');
        }

        return json({
            success: true,
            playerId: newPlayerId,
            playerIndex: newPlayerIndex,
            gameStatus: newStatus,
            totalPlayers: updatedPlayers.length
        });

    } catch (error) {
        console.error('❌ Failed to join game:', error);
        return json({ error: 'Failed to join game: ' + error.message }, { status: 500 });
    }
};

function generatePlayerId(): string {
    return Math.random().toString(36).substr(2, 9);
}
