import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import type { Player } from '$lib/game/state/GameState';
import { createPlayer, getErrorMessage } from '$lib/server/api-utils';
import { GameState } from '$lib/game/state/GameState';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        const body = await request.json() as { playerName?: string, preferredSlot?: number };
        const { playerName, preferredSlot } = body;

        if (!gameId || !playerName?.trim()) {
            return json({
                error: 'Game ID and player name are required'
            }, { status: 400 });
        }

        console.log(`🎮 Player "${playerName}" attempting to join game ${gameId}${preferredSlot !== undefined ? ` in slot ${preferredSlot}` : ''}`);

        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);
        
        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        if (game.status !== 'PENDING') {
            return json({ error: 'Game has already started or ended' }, { status: 400 });
        }

        // Check if player name is already taken
        const existingPlayer = game.players.find(p =>
            p.name.toLowerCase() === playerName.trim().toLowerCase()
        );
        if (existingPlayer) {
            return json({
                error: `Player name "${playerName}" is already taken`
            }, { status: 400 });
        }

        // Determine target slot
        let targetSlotIndex = preferredSlot;
        if (preferredSlot !== undefined) {
            // Validate preferred slot
            if (!game.pendingConfiguration?.playerSlots?.[preferredSlot]) {
                return json({ error: 'Invalid slot' }, { status: 400 });
            }
            
            const slot = game.pendingConfiguration.playerSlots[preferredSlot];
            if (slot.type !== 'Open') {
                return json({ error: 'Slot is not available' }, { status: 400 });
            }
            
            if (game.players.some(p => p.slotIndex === preferredSlot)) {
                return json({ error: 'Slot already taken' }, { status: 400 });
            }
        } else {
            targetSlotIndex = game.players.length;
            if (game.players.length >= GAME_CONSTANTS.MAX_PLAYERS) {
                return json({ error: 'Game is full' }, { status: 400 });
            }
        }

        // Ensure targetSlotIndex is defined
        if (targetSlotIndex === undefined) {
            return json({ error: 'Could not determine slot index' }, { status: 400 });
        }

        // Create new player
        const newPlayer = createPlayer(playerName.trim(), targetSlotIndex, false);
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

            const unfilledOpenSlots = openSlots.filter((slot, index) => {
                const slotIndex = playerSlots.findIndex(s => s === slot);
                return !updatedPlayers.some(p => p.slotIndex === slotIndex);
            });

            shouldStart = unfilledOpenSlots.length === 0;
        } else {
            shouldStart = updatedPlayers.length >= GAME_CONSTANTS.MAX_PLAYERS;
        }

        if (shouldStart) {
            console.log('🚀 All open slots filled - auto-starting game');
            updatedGame.status = 'ACTIVE';

            const regions = game.worldConflictState?.regions || [];
            const gameState = GameState.createInitialState(
                gameId,
                updatedPlayers,
                regions,
                game.worldConflictState?.maxTurns
            );

            updatedGame.worldConflictState = gameState.toJSON();
        }

        await gameStorage.saveGame(updatedGame);

        // Send WebSocket notifications
        await WebSocketNotifications.playerJoined(gameId, newPlayer, updatedGame);
        
        if (shouldStart) {
            await WebSocketNotifications.gameStarted(gameId, updatedGame);
        }

        console.log(`Player "${playerName}" successfully joined game ${gameId}${shouldStart ? ' and game started' : ''}`);

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