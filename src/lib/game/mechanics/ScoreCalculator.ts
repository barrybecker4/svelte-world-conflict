import type { GameStateData } from '$lib/game/state/GameState';

export class ScoreCalculator {

  private readonly gameState: GameStateData;

  constructor(gameState: GameStateData) {
    this.gameState = gameState;
  }

  calculatePlayerScore(playerIndex: number): number {
    const regionCount = this.getRegionCount(playerIndex);
    const soldierCount = this.getTotalSoldiers(playerIndex);
    return (1000 * regionCount) + soldierCount;
  }

  getRegionCount(playerIndex: number): number {
    const owners = this.gameState.ownersByRegion;
    if (!owners) {
      return 0;
    }
    return Object.values(owners).filter(owner => owner === playerIndex).length;
  }

  /**
   * Get total number of soldiers owned by a player across all regions
   */
  private getTotalSoldiers(playerIndex: number): number {
    const { ownersByRegion, soldiersByRegion } = this.gameState;

    if (!ownersByRegion || !soldiersByRegion) {
      return 0;
    }

    let totalSoldiers = 0;

    // Use a more robust for...in loop or Object.keys
    for (const regionIndexStr in soldiersByRegion) {
      if (Object.prototype.hasOwnProperty.call(soldiersByRegion, regionIndexStr)) {
        const owner = ownersByRegion[regionIndexStr];
        const soldiers = soldiersByRegion[regionIndexStr];

        if (owner === playerIndex && soldiers) {
          totalSoldiers += soldiers.length;
        }
      }
    }

    return totalSoldiers;
  }

  private isPlayerEliminated(playerIndex: number): boolean {
    return this.getRegionCount(playerIndex) === 0;
  }
}