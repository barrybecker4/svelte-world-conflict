import type { Player, GameStateData } from '$lib/game/state/GameState';
import { ScoreCalculator } from '$lib/game/mechanics/ScoreCalculator';

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
  private scoreCalculator: ScoreCalculator;

  constructor(gameState: GameStateData) {
    this.gameState = gameState;
    this.scoreCalculator = new ScoreCalculator(gameState);
  }

  /**
   * Calculate statistics for all players and rank them by score
   */
  calculatePlayerStats(players: Player[]): PlayerStats[] {
    if (!this.gameState || !players.length) {
      return [];
    }

    const stats = players.map(player => ({
      ...this.getPlayerStats(player),
      rank: 0 // Will be calculated after sorting
    }));

    // Sort by score descending and assign ranks
    stats.sort((a, b) => b.totalScore - a.totalScore);
    stats.forEach((stat, index) => {
      stat.rank = index + 1;
    });

    return stats;
  }

  getPlayerStats(player: Player): Omit<PlayerStats, 'rank'> {
    const regionCount = this.scoreCalculator.getRegionCount(player.slotIndex);
    const soldierCount = this.scoreCalculator.getTotalSoldiers(player.slotIndex);
    const faithCount = this.gameState.faithByPlayer[player.slotIndex] || 0;
    const totalScore = this.scoreCalculator.calculatePlayerScore(player.slotIndex);

    return {
      player,
      regionCount,
      soldierCount,
      faithCount,
      totalScore
    };
  }

  isPlayerEliminated(playerSlotIndex: number): boolean {
    return this.scoreCalculator.getRegionCount(playerSlotIndex) === 0;
  }

  getActivePlayers(players: Player[]): Player[] {
    return players.filter(player => !this.isPlayerEliminated(player.slotIndex));
  }

  getLeadingPlayer(players: Player[]): Player | null {
    const stats = this.calculatePlayerStats(players);
    return stats.length > 0 ? stats[0].player : null;
  }
}