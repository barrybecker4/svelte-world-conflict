import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState, type Player } from '$lib/game/state/GameState';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { Temple } from '$lib/game/entities/Temple';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

interface QuitGameRequest {
    playerId: string;
    reason?: 'RESIGN' | 'DISCONNECT' | 'TIMEOUT';
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        if (!gameId) {
            return json({ error: "Missing gameId" }, { status: 400 });
        }

        const body = await request.json() as QuitGameRequest;
        const { playerId, reason = 'RESIGN' } = body;

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        // Use GameStorage instead of direct KVStorage to ensure consistent key format
        const gameStorage = GameStorage.create(platform!);
        const game = await gameStorage.getGame(gameId);

        if (!game) {
            return json({ error: 'Game not found' }, { status: 404 });
        }

        // Find the player - convert playerId to number since it's stored as index
        const playerSlotIndex = parseInt(playerId);
        const player = game.players.find(p => p.slotIndex === playerSlotIndex);

        if (!player) {
            return json({ error: 'Player not found in game' }, { status: 400 });
        }

        // Handle different scenarios
        if (game.status === 'PENDING') {
            return await quitFromPendingGame(gameId, game, playerSlotIndex, player, playerId, gameStorage, platform);
        } else {
            return await quitFromActiveGame(gameId, game, player, gameStorage, platform);
        }

    } catch (error) {
        console.error('Error processing quit:', error);
        return json({ error: 'Failed to process quit' }, { status: 500 });
    }
};

async function quitFromPendingGame(
    gameId: string,
    game: GameRecord,
    playerSlotIndex: number,
    player: Player,
    playerId: string,
    gameStorage: GameStorage,
    platform: any
) {
    // Game hasn't started yet - remove player or delete game
    if (game.players.length === 1) {
        // Last player leaving, delete the game
        await gameStorage.deleteGame(gameId);
        console.log(`Deleted pending game ${gameId} - last player left`);

        return json({
            success: true,
            message: 'Game deleted - you were the last player',
            gameDeleted: true
        });
    } else {
        // Remove this player from the game
        const updatedPlayers = game.players.filter(p => p.slotIndex !== playerSlotIndex);
        const updatedGame = {
            ...game,
            players: updatedPlayers,
            lastMoveAt: Date.now()
        };

        await gameStorage.saveGame(updatedGame);

        console.log(`Player ${player.name} left pending game ${gameId}`);

        // Notify other players
        await WebSocketNotifications.playerLeft(gameId, playerId, updatedGame);

        return json({
            success: true,
            message: `${player.name} left the game`,
            game: updatedGame
        });
    }
}

async function quitFromActiveGame(
    gameId: string,
    game: GameRecord,
    player: Player,
    gameStorage: GameStorage,
    platform: any
) {
    const playerSlotIndex = player.slotIndex;
    console.log(`Player ${player.name} (slot ${playerSlotIndex}) resigned from active game ${gameId}`);

    // Create a GameState instance to use proper game logic
    let gameState = GameState.fromJSON(game.worldConflictState);

    // Eliminate the player - clear their regions and add to eliminatedPlayers
    PlayerEliminationService.eliminatePlayer(gameState.state, playerSlotIndex);

    // Check if it's currently this player's turn - if so, manually advance turn
    // We can't use EndTurnCommand because it checks game end before advancing
    const wasTheirTurn = gameState.currentPlayerSlot === playerSlotIndex;
    if (wasTheirTurn) {
        console.log(`💀 It was ${player.name}'s turn - advancing to next active player`);
        
        // Get next active player (skips eliminated players)
        const activeSlots = getActiveSlots(gameState.players, gameState.state);
        
        if (activeSlots.length === 0) {
            console.error('❌ No active players remaining!');
        } else {
            // Find current player's position in active slots
            const currentIndex = activeSlots.indexOf(playerSlotIndex);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % activeSlots.length : 0;
            const nextSlot = activeSlots[nextIndex];
            
            // Advance to next player
            gameState.currentPlayerSlot = nextSlot;
            
            // Reset turn state for the next player (like EndTurnCommand does)
            const nextPlayer = gameState.players.find(p => p.slotIndex === nextSlot);
            const airBonus = nextPlayer ? calculateAirBonus(gameState.state, nextPlayer) : 0;
            
            gameState.movesRemaining = GAME_CONSTANTS.BASE_MOVES_PER_TURN + airBonus;
            gameState.numBoughtSoldiers = 0;
            gameState.conqueredRegions = [];
            // Keep eliminatedPlayers array so client can show elimination banner
            
            console.log(`✅ Turn advanced to player slot ${nextSlot} (${nextPlayer?.name}) with ${gameState.movesRemaining} moves`);
        }
    }

    // Get the updated state data
    const updatedStateData = gameState.toJSON();

    // Debug: Check active player count
    const activeSlots = getActiveSlots(game.players, updatedStateData);
    console.log(`🔍 After elimination - Active players remaining: ${activeSlots.length}`, {
        allPlayers: game.players.map(p => ({ name: p.name, slot: p.slotIndex })),
        activeSlots,
        eliminatedPlayer: playerSlotIndex
    });

    // Check if game should end (1 or fewer active players remaining)
    const gameEndResult = checkGameEnd(updatedStateData, game.players);
    
    let updatedGame: GameRecord;
    let shouldEndGame = false;

    console.log(`🎮 Game end check result:`, {
        isGameEnded: gameEndResult.isGameEnded,
        winner: gameEndResult.winner,
        reason: gameEndResult.reason,
        activePlayerCount: activeSlots.length
    });

    if (gameEndResult.isGameEnded) {
        // Game ends - only 1 or 0 players left
        updatedGame = {
            ...game,
            status: 'COMPLETED' as const,
            worldConflictState: {
                ...updatedStateData,
                endResult: gameEndResult.winner
            },
            lastMoveAt: Date.now()
        };
        shouldEndGame = true;
        console.log(`🏁 Game ended after resignation - winner: ${gameEndResult.winner}`);
    } else {
        // Game continues with remaining players
        updatedGame = {
            ...game,
            worldConflictState: updatedStateData,
            lastMoveAt: Date.now()
        };
        console.log(`✅ Game continues with remaining active players`);
    }

    await gameStorage.saveGame(updatedGame);

    // Notify other players
    // Always send gameUpdate - the client's GameStateUpdater will detect game end
    // and show the victory screen automatically
    await WebSocketNotifications.gameUpdate(updatedGame);

    return json({
        success: true,
        message: `${player.name} resigned from the game`,
        game: updatedGame,
        gameEnded: shouldEndGame
    });
}

/**
 * Get list of active (non-eliminated) player slots
 */
function getActiveSlots(players: Player[], gameState: any): number[] {
    const activePlayers = players.filter(p => {
        const regionCount = Object.values(gameState.ownersByRegion).filter(
            owner => owner === p.slotIndex
        ).length;
        return regionCount > 0;
    });

    const activeSlots = activePlayers.map(p => p.slotIndex).sort((a, b) => a - b);
    console.log(`🔄 Active player slots: ${JSON.stringify(activeSlots)} (${activePlayers.map(p => p.name).join(', ')})`);
    return activeSlots;
}

/**
 * Calculate air temple bonus moves for a player
 */
function calculateAirBonus(gameState: any, player: Player): number {
    let totalAirBonus = 0;

    for (const [regionIndex, templeData] of Object.entries(gameState.templesByRegion)) {
        const regionIdx = parseInt(regionIndex);
        
        // Check if this temple is owned by the player
        if (gameState.ownersByRegion[regionIdx] === player.slotIndex) {
            const temple = Temple.deserialize(templeData);
            const airBonus = temple.getAirBonus();
            if (airBonus > 0) {
                totalAirBonus += airBonus;
            }
        }
    }

    return totalAirBonus;
}

