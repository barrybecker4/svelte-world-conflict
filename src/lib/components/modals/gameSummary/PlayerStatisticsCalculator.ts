import type { Player, GameStateData } from '$lib/game/state/GameState';

export interface PlayerStats {
  player: Player;
  regionCount: number;
  soldierCount: number;
  faithCount: number;
  totalScore: number;
  rank: number;
}

export class PlayerStatisticsCalculator {
  private gameState: GameStateData;

  constructor(gameState: GameStateData) {
    this.gameState = gameState;
  }

  /**
   * Calculate statistics for all players and rank them by score
   */
  calculatePlayerStats(players: Player[]): PlayerStats[] {
    if (!this.gameState || !players.length) {
      return [];
    }

    const stats = players.map(player => {
      const regionCount = this.getRegionCount(player.slotIndex);
      const soldierCount = this.getTotalSoldiers(player.slotIndex);
      const faithCount = this.gameState.faithByPlayer[player.slotIndex] || 0;

      // Calculate total score (same as game logic: 1000 * regions + soldiers)
      const totalScore = (1000 * regionCount) + soldierCount;

      return {
        player,
        regionCount,
        soldierCount,
        faithCount,
        totalScore,
        rank: 0 // Will be calculated after sorting
      };
    });

    // Sort by score descending and assign ranks
    stats.sort((a, b) => b.totalScore - a.totalScore);
    stats.forEach((stat, index) => {
      stat.rank = index + 1;
    });

    return stats;
  }

  private getRegionCount(playerSlotIndex: number): number {
    if (!this.gameState?.ownersByRegion) {
      return 0;
    }
    return Object.values(this.gameState.ownersByRegion)
      .filter(owner => owner === playerSlotIndex).length;
  }

  private getTotalSoldiers(playerSlotIndex: number): number {
    if (!this.gameState?.soldiersByRegion) {
      return 0;
    }

    let total = 0;
    Object.entries(this.gameState.soldiersByRegion).forEach(([regionIndexStr, soldiers]) => {
      const regionIndex = parseInt(regionIndexStr);
      if (this.gameState.ownersByRegion[regionIndex] === playerSlotIndex) {
        total += soldiers.length;
      }
    });

    return total;
  }

  getPlayerStats(player: Player): Omit<PlayerStats, 'rank'> {
    const regionCount = this.getRegionCount(player.slotIndex);
    const soldierCount = this.getTotalSoldiers(player.slotIndex);
    const faithCount = this.gameState.faithByPlayer[player.slotIndex] || 0;
    const totalScore = (1000 * regionCount) + soldierCount;

    return {
      player,
      regionCount,
      soldierCount,
      faithCount,
      totalScore
    };
  }

  isPlayerEliminated(playerSlotIndex: number): boolean {
    return this.getRegionCount(playerSlotIndex) === 0;
  }

  getActivePlayers(players: Player[]): Player[] {
    return players.filter(player => !this.isPlayerEliminated(player.slotIndex));
  }

  getLeadingPlayer(players: Player[]): Player | null {
    const stats = this.calculatePlayerStats(players);
    return stats.length > 0 ? stats[0].player : null;
  }
}