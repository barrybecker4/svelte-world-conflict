import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.ts';
import {
    WorldConflictKVStorage,
    WorldConflictGameStorage
} from '$lib/storage/index.ts';
import { GameState } from '$lib/game/GameState.ts';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper.ts';
import type { Player } from '$lib/game/GameState.ts';
import { createPlayer } from '$lib/server/api-utils.js';
import { getErrorMessage } from '$lib/server/api-utils.ts';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";

interface JoinGameRequest {
    playerName?: string; // Make optional and provide default
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const { gameId } = params;
        const body = await request.json() as JoinGameRequest;

        // Provide default name if none provided
        const playerName = body.playerName?.trim() || `Player${Date.now().toString().slice(-4)}`;

        console.log(`Player "${playerName}" attempting to join game ${gameId}`);

        const kv = new WorldConflictKVStorage(platform!);
        const gameStorage = new WorldConflictGameStorage(kv);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        console.log(`Game status: ${game.status}, Current players: ${game.players.length}`);

        // Only allow joining PENDING games
        if (game.status !== 'PENDING') {
            return json({ error: 'Game is no longer accepting new players' }, { status: 400 });
        }

        let maxPlayers = GAME_CONSTANTS.MAX_PLAYERS;

        // If game has pendingConfiguration, check how many slots are actually open
        if (game.pendingConfiguration?.playerSlots) {
            const activeSlots = game.pendingConfiguration.playerSlots.filter(
                (slot: any) => slot.type !== 'Off'
            );
            maxPlayers = activeSlots.length;

            // Count current human players (exclude AI placeholders)
            const currentHumanPlayers = game.players.filter((p: Player) => !p.isAI).length;

            if (currentHumanPlayers >= maxPlayers) {
                return json({ error: 'No open slots available' }, { status: 400 });
            }
        } else {
            // Fallback: check if we've exceeded standard max
            if (game.players.length >= maxPlayers) {
                return json({ error: 'Game is full' }, { status: 400 });
            }
        }

        // Check if player name is already taken in this game
        const existingPlayer = game.players.find((p: Player) =>
            p.name.toLowerCase() === playerName.toLowerCase()
        );

        if (existingPlayer) {
            return json({
                error: `Name "${playerName}" is already taken. Try a different name.`
            }, { status: 400 });
        }

        // Create player with proper index
        const newPlayerIndex = game.players.length;
        const newPlayer = createPlayer(playerName, newPlayerIndex, false);

        console.log(`Creating new player:`, newPlayer);

        const updatedPlayers = [...game.players, newPlayer];

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
            // Keep status as 'PENDING' - don't auto-start!
        };

        // Only auto-start if ALL slots are now filled with human players
        const humanPlayerCount = updatedPlayers.filter(p => !p.isAI).length;

        if (game.pendingConfiguration?.playerSlots) {
            const activeSlots = game.pendingConfiguration.playerSlots.filter(
                (slot: any) => slot.type !== 'Off'
            );
            const openSlots = activeSlots.filter((slot: any) => slot.type === 'Open');

            // Only auto-start if no open slots remain
            if (openSlots.length === 0 || humanPlayerCount >= activeSlots.length) {
                console.log('🚀 All slots filled - auto-starting game');
                updatedGame.status = 'ACTIVE';

                // Initialize World Conflict game state
                const regions = game.worldConflictState?.regions || [];
                const gameState = GameState.createInitialState(
                    gameId,
                    updatedPlayers,
                    regions
                );

                updatedGame.worldConflictState = gameState.toJSON();
            }
        } else if (updatedPlayers.length >= GAME_CONSTANTS.MAX_PLAYERS) {
            // Fallback logic
            updatedGame.status = 'ACTIVE';

            const regions = game.worldConflictState?.regions || [];
            const gameState = GameState.createInitialState(
                gameId,
                updatedPlayers,
                regions
            );

            updatedGame.worldConflictState = gameState.toJSON();
        }

        console.log("💾 Saving game after join. gameId: " + updatedGame.gameId);
        await gameStorage.saveGame(updatedGame);

        // Always notify WebSocket clients about the join
        console.log("📡 Sending WebSocket notification...");
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        console.log(`Player "${playerName}" successfully joined game ${gameId}`);

        return json({
            success: true,
            player: newPlayer,
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            }
        });

    } catch (error) {
        console.error('Error joining game:', error);
        return json({
            error: 'Failed to join game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};