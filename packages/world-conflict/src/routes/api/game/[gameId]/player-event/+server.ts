import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WebSocketNotifications } from '$lib/server/websocket/WebSocketNotifier';
import { GameStorage, type GameRecord } from '$lib/server/storage/GameStorage';
import { GameState, type Player } from '$lib/game/state/GameState';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { Temple } from '$lib/game/entities/Temple';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

interface PlayerEventRequest {
    type: 'disconnect' | 'reconnect' | 'idle';
    playerId: string;
    timestamp: number;
}

/**
 * Convention-based endpoint for player events from the WebSocket Durable Object
 * Handles disconnects, reconnects, and other player lifecycle events
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
    try {
        const gameId = params.gameId;
        if (!gameId) {
            return json({ error: "Missing gameId" }, { status: 400 });
        }

        const body = await request.json() as PlayerEventRequest;
        const { type, playerId, timestamp } = body;

        console.log(`📬 [player-event] Received ${type} event for player ${playerId} in game ${gameId}`);

        if (!playerId) {
            return json({ error: 'Player ID is required' }, { status: 400 });
        }

        // Route to appropriate handler based on event type
        switch (type) {
            case 'disconnect':
                return await handlePlayerDisconnect(gameId, playerId, platform);
            case 'reconnect':
                return await handlePlayerReconnect(gameId, playerId, platform);
            case 'idle':
                return await handlePlayerIdle(gameId, playerId, platform);
            default:
                console.warn(`⚠️ [player-event] Unknown event type: ${type}`);
                return json({ error: `Unknown event type: ${type}` }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ [player-event] Error processing player event:', error);
        return json({ error: 'Failed to process player event' }, { status: 500 });
    }
};

/**
 * Handle player disconnect - eliminate player from active game
 */
async function handlePlayerDisconnect(
    gameId: string,
    playerId: string,
    platform: any
): Promise<Response> {
    const gameStorage = GameStorage.create(platform!);
    const game = await gameStorage.getGame(gameId);

    if (!game) {
        console.warn(`⚠️ [disconnect] Game ${gameId} not found`);
        return json({ error: 'Game not found' }, { status: 404 });
    }

    // Parse playerId to slot index
    const playerSlotIndex = parseInt(playerId);
    const player = game.players.find(p => p.slotIndex === playerSlotIndex);

    if (!player) {
        console.warn(`⚠️ [disconnect] Player ${playerId} not found in game ${gameId}`);
        return json({ error: 'Player not found in game' }, { status: 400 });
    }

    // Only process disconnects for active games
    if (game.status !== 'ACTIVE') {
        console.log(`ℹ️ [disconnect] Game ${gameId} is ${game.status}, ignoring disconnect for player ${player.name}`);
        return json({
            success: true,
            message: 'Disconnect ignored - game not active',
            gameStatus: game.status
        });
    }

    // Ignore disconnects if game just started (within last 5 seconds)
    // This prevents eliminating players who disconnect from waiting room when transitioning to game
    const timeSinceLastMove = Date.now() - game.lastMoveAt;
    if (timeSinceLastMove < 5000) {
        console.log(`ℹ️ [disconnect] Ignoring disconnect for player ${player.name} - game just started ${(timeSinceLastMove / 1000).toFixed(1)}s ago`);
        return json({
            success: true,
            message: 'Disconnect ignored - game just started',
            timeSinceStart: timeSinceLastMove
        });
    }

    // Check if player is already eliminated
    const eliminatedPlayers = game.worldConflictState?.eliminatedPlayers || [];
    if (eliminatedPlayers.includes(playerSlotIndex)) {
        console.log(`ℹ️ [disconnect] Player ${player.name} already eliminated, ignoring disconnect`);
        return json({
            success: true,
            message: 'Player already eliminated',
            alreadyEliminated: true
        });
    }

    console.log(`🔌 [disconnect] Processing disconnect for player ${player.name} (slot ${playerSlotIndex}) in game ${gameId}`);

    // Eliminate the player using same logic as resignation
    let gameState = GameState.fromJSON(game.worldConflictState);
    PlayerEliminationService.eliminatePlayer(gameState.state, playerSlotIndex);

    // If it's currently this player's turn, advance to next player
    const wasTheirTurn = gameState.currentPlayerSlot === playerSlotIndex;
    if (wasTheirTurn) {
        console.log(`🔄 [disconnect] Was player ${player.name}'s turn, advancing to next player`);
        
        // Get next active player (skips eliminated players)
        const activeSlots = getActiveSlots(gameState.players, gameState.state);
        
        if (activeSlots.length === 0) {
            console.error('❌ [disconnect] No active players remaining!');
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
            
            console.log(`✅ [disconnect] Turn advanced to player slot ${nextSlot} (${nextPlayer?.name}) with ${gameState.movesRemaining} moves`);
        }
    }

    // Convert back to plain JSON
    const updatedStateData = gameState.toJSON();

    // Check if game should end
    const activeSlots = game.players
        .filter(p => !updatedStateData.eliminatedPlayers.includes(p.slotIndex))
        .map(p => p.slotIndex);

    const gameEndResult = checkGameEnd(updatedStateData, game.players);
    
    let updatedGame: GameRecord;
    let shouldEndGame = false;

    console.log(`🎮 [disconnect] Game end check result:`, {
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
        console.log(`🏁 [disconnect] Game ended after disconnect - winner: ${gameEndResult.winner}`);
    } else {
        // Game continues with remaining players
        updatedGame = {
            ...game,
            worldConflictState: updatedStateData,
            lastMoveAt: Date.now()
        };
        console.log(`✅ [disconnect] Game continues with remaining active players`);
    }

    await gameStorage.saveGame(updatedGame);

    // Notify other players via WebSocket
    await WebSocketNotifications.gameUpdate(updatedGame);

    return json({
        success: true,
        message: `Player ${player.name} disconnected and was eliminated`,
        playerName: player.name,
        gameEnded: shouldEndGame,
        winner: shouldEndGame ? gameEndResult.winner : undefined
    });
}

/**
 * Handle player reconnect - could be used for grace period logic in the future
 */
async function handlePlayerReconnect(
    gameId: string,
    playerId: string,
    platform: any
): Promise<Response> {
    console.log(`🔗 [reconnect] Player ${playerId} reconnected to game ${gameId}`);
    // Future: Could cancel pending elimination, restore AI control, etc.
    return json({
        success: true,
        message: 'Reconnect acknowledged (not yet implemented)'
    });
}

/**
 * Handle player idle - could be used for timeout/inactivity logic
 */
async function handlePlayerIdle(
    gameId: string,
    playerId: string,
    platform: any
): Promise<Response> {
    console.log(`⏰ [idle] Player ${playerId} idle in game ${gameId}`);
    // Future: Could warn player, start countdown, etc.
    return json({
        success: true,
        message: 'Idle acknowledged (not yet implemented)'
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
    console.log(`🔄 [disconnect] Active player slots: ${JSON.stringify(activeSlots)} (${activePlayers.map(p => p.name).join(', ')})`);
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


