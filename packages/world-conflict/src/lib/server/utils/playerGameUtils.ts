/**
 * Shared utilities for player-related game operations
 * Used by quit and player-event endpoints to handle player elimination and turn advancement
 */
import { GameState, type Player } from '$lib/game/state/GameState';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';
import { Temple } from '$lib/game/entities/Temple';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

/**
 * Get list of active (non-eliminated) player slots
 */
export function getActiveSlots(players: Player[], gameState: any): number[] {
    const activePlayers = players.filter(p => {
        const regionCount = Object.values(gameState.ownersByRegion).filter(
            owner => owner === p.slotIndex
        ).length;
        return regionCount > 0;
    });

    const activeSlots = activePlayers.map(p => p.slotIndex).sort((a, b) => a - b);
    logger.debug(`Active player slots: ${JSON.stringify(activeSlots)} (${activePlayers.map(p => p.name).join(', ')})`);
    return activeSlots;
}

/**
 * Calculate air temple bonus moves for a player
 */
export function calculateAirBonus(gameState: any, player: Player): number {
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

/**
 * Eliminate a player and advance the turn if it was their turn
 * Returns the updated game state
 */
export function eliminateAndAdvanceTurn(
    gameState: GameState,
    playerSlotIndex: number,
    playerName: string
): GameState {
    // Eliminate the player - clear their regions and add to eliminatedPlayers
    PlayerEliminationService.eliminatePlayer(gameState.state, playerSlotIndex);

    // Check if it's currently this player's turn - if so, advance to next player
    const wasTheirTurn = gameState.currentPlayerSlot === playerSlotIndex;
    if (wasTheirTurn) {
        logger.debug(`It was ${playerName}'s turn - advancing to next active player`);

        // Get next active player (skips eliminated players)
        const activeSlots = getActiveSlots(gameState.players, gameState.state);

        if (activeSlots.length === 0) {
            logger.error('No active players remaining!');
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

            logger.debug(`Turn advanced to player slot ${nextSlot} (${nextPlayer?.name}) with ${gameState.movesRemaining} moves`);
        }
    }

    return gameState;
}
