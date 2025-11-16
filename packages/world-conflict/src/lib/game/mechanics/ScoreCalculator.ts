import type { GameStateData } from '$lib/game/state/GameState';

export class ScoreCalculator {

  private readonly gameState: GameStateData;

  constructor(gameState: GameStateData) {
    this.gameState = gameState;
  }

  calculatePlayerScore(playerSlotIndex: number): number {
    const regionCount = this.getRegionCount(playerSlotIndex);
    const soldierCount = this.getTotalSoldiers(playerSlotIndex);
    return (1000 * regionCount) + soldierCount;
  }

  getRegionCount(playerSlotIndex: number): number {
    const owners = this.gameState.ownersByRegion;
    if (!owners) {
      return 0;
    }
    return Object.values(owners).filter(owner => owner === playerSlotIndex).length;
  }

  /**
   * Get total number of soldiers owned by a player across all regions
   */
  getTotalSoldiers(playerSlotIndex: number): number {
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

        if (owner === playerSlotIndex && soldiers) {
          totalSoldiers += soldiers.length;
        }
      }
    }

    return totalSoldiers;
  }
}
