import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/index.ts';
import { GameState } from '$lib/game/GameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player } from '$lib/game/GameState.ts';

interface StartGameRequest {
    playerId: string; // The ID of the player requesting to start (must be creator)
}

/**
 * Start a PENDING game anyway, filling any empty slots with AI players
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const { playerId } = await request.json() as StartGameRequest;

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game is not in a startable state' }, { status: 400 });
        }

        // Verify that the requesting player is the game creator (first player)
        const creator = game.players[0];
        if (!creator || creator.index.toString() !== playerId) {
            return json({ error: 'Only the game creator can start the game' }, { status: 403 });
        }

        // If we have pending configuration, use it to fill remaining slots
        if (game.pendingConfiguration) {
            const { playerSlots } = game.pendingConfiguration;
            const maxSlots = playerSlots.filter(slot => slot.type !== 'Off').length;
            
            // Fill any "Open" slots that weren't filled by human players with AI
            const aiPlayerNames = ['AI Easy', 'AI Normal', 'AI Hard', 'AI Expert'];
            const aiLevels = [0, 1, 2, 3]; // Nice, Rude, Mean, Evil
            
            let playerIndex = game.players.length; // Start from next available index
            
            for (const slot of playerSlots) {
                if (slot.type === 'Open') {
                    // Check if this slot was already filled by a human player
                    const existingPlayer = game.players.find(p => p.index === slot.index);
                    if (!existingPlayer) {
                        // Fill with AI
                        const aiPlayer: Player = {
                            id: `ai_${slot.index}_${Date.now()}`,
                            name: aiPlayerNames[slot.index] || `AI Player ${slot.index + 1}`,
                            color: getPlayerColor(slot.index),
                            isAI: true,
                            index: slot.index,
                            aiLevel: aiLevels[slot.index % aiLevels.length]
                        };
                        game.players.push(aiPlayer);
                    }
                } else if (slot.type === 'AI') {
                    // Add AI players that were configured but not yet added
                    const existingPlayer = game.players.find(p => p.index === slot.index);
                    if (!existingPlayer) {
                        const aiPlayer: Player = {
                            id: `ai_${slot.index}_${Date.now()}`,
                            name: slot.name,
                            color: getPlayerColor(slot.index),
                            isAI: true,
                            index: slot.index,
                            aiLevel: aiLevels[slot.index % aiLevels.length]
                        };
                        game.players.push(aiPlayer);
                    }
                }
            }
        } else {
            // Fallback: Fill empty slots with AI players up to 4 total
            const maxPlayers = 4;
            const currentPlayerCount = game.players.length;
            const aiPlayerNames = ['AI Easy', 'AI Normal', 'AI Hard', 'AI Expert'];
            const aiLevels = [0, 1, 2, 3]; // Nice, Rude, Mean, Evil

            for (let i = currentPlayerCount; i < maxPlayers; i++) {
                const aiPlayer: Player = {
                    id: `ai_${i}_${Date.now()}`,
                    name: aiPlayerNames[i] || `AI Player ${i + 1}`,
                    color: getPlayerColor(i),
                    isAI: true,
                    index: i,
                    aiLevel: aiLevels[i % aiLevels.length]
                };
                game.players.push(aiPlayer);
            }
        }

        // Change status to ACTIVE
        game.status = 'ACTIVE';
        game.lastMoveAt = Date.now();

        // Initialize World Conflict game state with all players (human + AI)
        const gameState = GameState.createInitialState(
            gameId,
            game.players,
            game.worldConflictState.regions || []
        );

        game.worldConflictState = gameState.toJSON();

        // Clear pending configuration since game is now active
        delete game.pendingConfiguration;

        await gameStorage.saveGame(game);

        // Notify all connected players that the game has started
        await WebSocketNotificationHelper.sendGameUpdate(game, platform!);

        return json({
            success: true,
            game: {
                ...game,
                playerCount: game.players.length
            }
        });

    } catch (error) {
        console.error('Error starting game:', error);
        return json({
            error: 'Failed to start game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};
