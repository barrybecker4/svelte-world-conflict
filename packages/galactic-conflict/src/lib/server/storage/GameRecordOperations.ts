/**
 * Game Record Operations - Player management operations for game records
 */

import type { Player } from '$lib/game/entities/gameTypes';
import type { GameRecord } from './GameStorage';
import { logger } from 'multiplayer-framework/shared';

/**
 * Add a player to a pending game
 */
export async function addPlayerToGame(
    game: GameRecord,
    player: Player,
    slotIndex: number,
    saveGame: (game: GameRecord) => Promise<void>
): Promise<boolean> {
    if (game.status !== 'PENDING') {
        logger.warn(`Cannot add player to game ${game.gameId}: game not pending`);
        return false;
    }

    if (!game.pendingConfiguration?.playerSlots) {
        logger.warn(`Cannot add player to game ${game.gameId}: no pending configuration`);
        return false;
    }

    // Find the slot and verify it's open
    const slot = game.pendingConfiguration.playerSlots.find(s => s.slotIndex === slotIndex);
    if (!slot || slot.type !== 'Open') {
        logger.warn(`Cannot add player to slot ${slotIndex}: slot not found or not open`);
        return false;
    }

    // Update slot to Set (human player)
    slot.type = 'Set';
    slot.name = player.name;

    // Add player to players array
    game.players.push(player);

    await saveGame(game);
    logger.debug(`Added player ${player.name} to game ${game.gameId} at slot ${slotIndex}`);
    
    return true;
}

/**
 * Remove a player from a pending game
 */
export async function removePlayerFromGame(
    game: GameRecord,
    slotIndex: number,
    saveGame: (game: GameRecord) => Promise<void>
): Promise<boolean> {
    if (game.status !== 'PENDING') {
        return false;
    }

    if (!game.pendingConfiguration?.playerSlots) {
        return false;
    }

    // Find the slot
    const slot = game.pendingConfiguration.playerSlots.find(s => s.slotIndex === slotIndex);
    if (!slot || slot.type !== 'Set') {
        return false;
    }

    // Reset slot to Open
    slot.type = 'Open';
    delete slot.name;

    // Remove player from players array
    game.players = game.players.filter(p => p.slotIndex !== slotIndex);

    await saveGame(game);
    return true;
}

/**
 * Check if all slots are filled and game can start
 */
export function canGameStart(game: GameRecord): boolean {
    if (game.status !== 'PENDING') {
        return false;
    }

    if (!game.pendingConfiguration?.playerSlots) {
        return false;
    }

    // Check if any slots are still Open
    return !game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open');
}

