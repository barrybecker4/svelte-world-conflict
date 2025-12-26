import type { GameStateData, Player } from '$lib/game/entities/gameTypes';
import { logger } from 'multiplayer-framework/shared';
import { ScoreCalculator } from '$lib/game/mechanics/ScoreCalculator';

/**
 * Shared service for player elimination detection
 * Consolidates duplicate logic from BattleCoordinator, GameStateUpdater, and ArmyMoveCommand
 */
export class PlayerEliminationService {
    /**
     * Check for eliminated players and return their slot indices
     * A player is eliminated when they own 0 regions
     */
    static checkForEliminations(gameState: GameStateData): number[] {
        const players = gameState.players || [];
        const regionCounts = this.getRegionCountByPlayer(gameState);
        const eliminatedPlayers: number[] = [];

        // Check each player - if they have 0 regions, they're eliminated
        for (const player of players) {
            const regionCount = regionCounts.get(player.slotIndex) || 0;
            if (regionCount === 0) {
                logger.debug(`💀 Player ${player.name} (slot ${player.slotIndex}) has been eliminated!`);
                eliminatedPlayers.push(player.slotIndex);
            }
        }

        return eliminatedPlayers;
    }

    /**
     * Count regions owned by each player
     * Returns a Map of player slot index -> region count
     */
    static getRegionCountByPlayer(gameState: GameStateData): Map<number, number> {
        const ownersByRegion = gameState.ownersByRegion || {};
        const regionCounts = new Map<number, number>();

        for (const playerSlotIndex of Object.values(ownersByRegion)) {
            regionCounts.set(playerSlotIndex, (regionCounts.get(playerSlotIndex) || 0) + 1);
        }

        return regionCounts;
    }

    /**
     * Check if a specific player has been eliminated
     */
    static isPlayerEliminated(gameState: GameStateData, playerSlotIndex: number): boolean {
        const scoreCalculator = new ScoreCalculator(gameState);
        return scoreCalculator.getRegionCount(playerSlotIndex) === 0;
    }

    /**
     * Eliminate a player from the game
     * - Adds them to the eliminatedPlayers array
     * - Removes ownership of all their regions (regions become neutral/gray)
     * - Keeps soldiers in place
     */
    static eliminatePlayer(gameState: GameStateData, playerSlotIndex: number): void {
        // Add to eliminatedPlayers array if not already there
        if (!gameState.eliminatedPlayers) {
            gameState.eliminatedPlayers = [];
        }
        if (!gameState.eliminatedPlayers.includes(playerSlotIndex)) {
            gameState.eliminatedPlayers.push(playerSlotIndex);
            logger.debug(`💀 Eliminating player ${playerSlotIndex} - adding to eliminatedPlayers array`);
        }

        // Remove ownership of all regions owned by this player
        // Soldiers remain, but regions become neutral (gray)
        const regionsCleared: number[] = [];
        for (const regionIndex in gameState.ownersByRegion) {
            if (gameState.ownersByRegion[regionIndex] === playerSlotIndex) {
                delete gameState.ownersByRegion[regionIndex];
                regionsCleared.push(parseInt(regionIndex));
            }
        }

        logger.debug(
            `💀 Cleared ownership of ${regionsCleared.length} regions for player ${playerSlotIndex}:`,
            regionsCleared
        );
    }
}
