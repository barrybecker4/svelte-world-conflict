import type { GameStateData, Player } from '$lib/game/entities/gameTypes';

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
        console.log(`💀 Player ${player.name} (slot ${player.slotIndex}) has been eliminated!`);
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
    const regionCounts = this.getRegionCountByPlayer(gameState);
    return (regionCounts.get(playerSlotIndex) || 0) === 0;
  }
}

