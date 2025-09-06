import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import type { Player } from '$lib/game/classes/GameState';
import { createPlayer, getErrorMessage } from '$lib/server/api-utils';
import { GameState } from '$lib/game/classes/GameState';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { WebSocketNotificationHelper } from '$lib/server/WebSocketNotificationHelper';
import { GameNotifications } from '$lib/server/websocket';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        const { playerName, preferredSlot } = await request.json();

        if (!gameId || !playerName?.trim()) {
            return json({
                error: 'Game ID and player name are required'
            }, { status: 400 });
        }

        console.log(`🎮 Player "${playerName}" attempting to join game ${gameId}${preferredSlot !== undefined ? ` in slot ${preferredSlot}` : ''}`);

        const gameStorage = GameStorage.create(platform!);

        const game = await gameStorage.getGame(gameId);
        if (!game) {
            return json({
                error: 'Game not found'
            }, { status: 404 });
        }

        // Check if game is joinable
        if (game.status !== 'PENDING') {
            return json({
                error: 'Game has already started or ended'
            }, { status: 400 });
        }

        // Check if player name is already taken
        const existingPlayer = game.players.find(p =>
            p.name.toLowerCase() === playerName.trim().toLowerCase()
        );
        if (existingPlayer) {
            return json({
                error: `Player name "${playerName}" is already taken. Try a different name.`
            }, { status: 400 });
        }

        // Determine the slot to join
        let targetSlotIndex = preferredSlot;

        if (game.pendingConfiguration?.playerSlots) {
            const playerSlots = game.pendingConfiguration.playerSlots;

            // If preferred slot specified, validate it
            if (preferredSlot !== undefined) {
                if (preferredSlot < 0 || preferredSlot >= playerSlots.length) {
                    return json({
                        error: 'Invalid slot index'
                    }, { status: 400 });
                }

                const slot = playerSlots[preferredSlot];
                if (!slot || slot.type !== 'Open') {
                    return json({
                        error: 'Selected slot is not available'
                    }, { status: 400 });
                }

                // Check if slot is already taken by an existing player
                const slotTaken = game.players.some(p => p.index === preferredSlot);
                if (slotTaken) {
                    return json({
                        error: 'Selected slot is already taken'
                    }, { status: 400 });
                }

                targetSlotIndex = preferredSlot;
            } else {
                // Find first available open slot
                targetSlotIndex = playerSlots.findIndex((slot, index) =>
                    slot && slot.type === 'Open' &&
                    !game.players.some(p => p.index === index)
                );

                if (targetSlotIndex === -1) {
                    return json({
                        error: 'No open slots available'
                    }, { status: 400 });
                }
            }
        } else {
            // Fallback logic for games without proper slot configuration
            targetSlotIndex = preferredSlot !== undefined ? preferredSlot : game.players.length;

            if (game.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
                return json({
                    error: 'Game is full'
                }, { status: 400 });
            }
        }

        // Create new player with the determined slot index
        const newPlayer = createPlayer(playerName.trim(), targetSlotIndex, false);
        console.log(`Creating new player:`, newPlayer);

        const updatedPlayers = [...game.players, newPlayer];

        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        // Check if game should auto-start
        let shouldStart = false;

        if (game.pendingConfiguration?.playerSlots) {
            const playerSlots = game.pendingConfiguration.playerSlots;
            const activeSlots = playerSlots.filter((slot: any) => slot && slot.type !== 'Off');
            const openSlots = activeSlots.filter((slot: any) => slot.type === 'Open');

            // Count how many open slots are still unfilled
            const unfilledOpenSlots = openSlots.filter((slot, index) => {
                const slotIndex = playerSlots.findIndex(s => s === slot);
                return !updatedPlayers.some(p => p.index === slotIndex);
            });

            // Auto-start if no open slots remain unfilled
            shouldStart = unfilledOpenSlots.length === 0;
            console.log(`Open slots check: ${unfilledOpenSlots.length} unfilled open slots remaining`);
        } else {
            // Fallback: start if we hit max players
            shouldStart = updatedPlayers.length >= GAME_CONSTANTS.MAX_PLAYERS;
        }

        if (shouldStart) {
            console.log('🚀 All open slots filled - auto-starting game');
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

        console.log("Saving game after join. gameId: " + updatedGame.gameId);
        await gameStorage.saveGame(updatedGame);

        // Send WebSocket notifications
        console.log("Sending WebSocket notifications...");

        // Notify about player joining
        await GameNotifications.playerJoined(gameId, newPlayer, updatedGame);

        // If game started, also notify about that
        if (shouldStart) {
            await GameNotifications.gameStarted(gameId, updatedGame);
        }

        // Also send the general game update notification
        await WebSocketNotificationHelper.sendGameUpdate(updatedGame, platform!);

        console.log(`Player "${playerName}" successfully joined game ${gameId} in slot ${targetSlotIndex}${shouldStart ? ' and game started' : ''}`);

        return json({
            success: true,
            player: newPlayer,
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            },
            gameStarted: shouldStart
        });

    } catch (error) {
        console.error('Error joining game:', error);
        return json({
            error: 'Failed to join game',
            details: getErrorMessage(error)
        }, { status: 500 });
    }
};
