import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { createPlayer, handleApiError } from '$lib/server/api-utils';
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
            // Find the slot configuration by slotIndex property, not array index
            // because playerSlots may not have all slots (e.g., if some are "Off")
            const slot = game.pendingConfiguration?.playerSlots?.find((s: any) => s.slotIndex === preferredSlot);

            if (!slot) {
                console.error(`❌ Slot ${preferredSlot} not found in playerSlots`);
                return json({ error: 'Invalid slot' }, { status: 400 });
            }

            if (slot.type !== 'Open') {
                console.error(`❌ Slot ${preferredSlot} is type ${slot.type}, not Open`);
                return json({ error: 'Slot is not available' }, { status: 400 });
            }

            if (game.players.some((p: any) => p.slotIndex === preferredSlot)) {
                console.error(`❌ Slot ${preferredSlot} already taken by ${game.players.find((p: any) => p.slotIndex === preferredSlot)?.name}`);
                return json({ error: 'Slot already taken' }, { status: 400 });
            }

            // Use the slot's slotIndex (should match preferredSlot, but be explicit)
            targetSlotIndex = slot.slotIndex;
            console.log(`✅ Assigning player to slot ${targetSlotIndex}`);
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
            const moveTimeLimit = game.pendingConfiguration?.settings?.timeLimit ||
                                  game.worldConflictState?.moveTimeLimit ||
                                  GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;
            const aiDifficulty = game.pendingConfiguration?.settings?.aiDifficulty ||
                                game.worldConflictState?.aiDifficulty ||
                                'Normal';

            console.log(`🎮 Auto-starting game with ${updatedPlayers.length} players, timeLimit: ${moveTimeLimit}, difficulty: ${aiDifficulty}`);

            const gameState = GameState.createInitialState(
                gameId,
                updatedPlayers,
                regions,
                game.worldConflictState?.maxTurns,
                moveTimeLimit,
                aiDifficulty
            );

            const gameStateJSON = gameState.toJSON();
            updatedGame.worldConflictState = gameStateJSON;

            console.log('📊 Before sync - updatedPlayers:', updatedPlayers.map((p: any) => `${p.name}(slot ${p.slotIndex})`));
            console.log('📊 GameState players:', gameStateJSON.players.map((p: any) => `${p.name}(slot ${p.slotIndex})`));
            console.log('📊 newPlayer:', `${newPlayer.name}(slot ${newPlayer.slotIndex})`);

            // Sync the top-level players array with the sorted players from game state
            // This ensures consistency throughout the system
            updatedGame.players = gameStateJSON.players;

            console.log('✅ Game started - players synced:', updatedGame.players.map((p: any) => `${p.name}(slot ${p.slotIndex})`));
        }

        await gameStorage.saveGame(updatedGame);

        // Send WebSocket notifications
        await WebSocketNotifications.playerJoined(gameId, newPlayer, updatedGame);

        if (shouldStart) {
            await WebSocketNotifications.gameStarted(gameId, updatedGame);
            // Also send gameUpdate to ensure all clients get the initial game state
            await WebSocketNotifications.gameUpdate(updatedGame);
        }

        console.log(`Player "${playerName}" successfully joined game ${gameId}${shouldStart ? ' and game started' : ''}`);

        // After game starts, players array may be re-sorted by slot index
        // Return the player from the updated game to ensure correct slot assignment
        let playerToReturn;
        if (shouldStart) {
            console.log(`🔍 Looking for player with slotIndex ${newPlayer.slotIndex} in updatedGame.players`);
            console.log(`🔍 Available players:`, updatedGame.players.map((p: any) => `${p.name}(slot ${p.slotIndex})`));
            playerToReturn = updatedGame.players.find((p: any) => p.slotIndex === newPlayer.slotIndex);
            if (!playerToReturn) {
                console.error(`❌ Could not find player with slotIndex ${newPlayer.slotIndex}, falling back to newPlayer`);
                playerToReturn = newPlayer;
            } else {
                console.log(`✅ Found player: ${playerToReturn.name}(slot ${playerToReturn.slotIndex})`);
            }
        } else {
            playerToReturn = newPlayer;
        }

        console.log(`📤 Returning player info to client: ${playerToReturn.name} in slot ${playerToReturn.slotIndex}`);

        return json({
            success: true,
            player: playerToReturn,
            game: {
                ...updatedGame,
                playerCount: updatedGame.players.length
            },
            gameStarted: shouldStart
        });

    } catch (error) {
        return handleApiError(error, 'joining game');
    }
};
