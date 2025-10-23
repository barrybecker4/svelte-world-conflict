/**
 * Represents a detected move from comparing game states
 */
export interface DetectedMove {
  type: 'conquest' | 'movement' | 'recruitment' | 'upgrade';
  regionIndex: number;
  newOwner?: number;
  oldOwner?: number;
  soldierCount?: number;
  oldCount?: number;
  newCount?: number;
  sourceRegion?: number; // For tracking where soldiers came from
  attackSequence?: any[]; // Battle animation sequence for replay
}

/**
 * Detects moves by comparing game states
 * Extracted from MoveReplayer to separate detection logic from playback
 */
export class MoveDetector {
  /**
   * Detect moves by comparing game states
   * @param newState - The updated game state
   * @param previousState - The previous game state
   * @returns Array of detected moves
   */
  detectMoves(newState: any, previousState: any): DetectedMove[] {
    const moves: DetectedMove[] = [];

    // Build adjacency map for pairing movements
    const movementPairs = this.buildMovementPairs(newState, previousState);

    // Check for region ownership changes (conquests)
    this.detectConquests(newState, previousState, moves, movementPairs);

    // Check for soldier count changes (recruitment or movement)
    this.detectSoldierChanges(newState, previousState, moves, movementPairs);

    // Check for temple upgrades
    this.detectTemplateUpgrades(newState, previousState, moves);

    return moves;
  }

  /**
   * Build a map of movement pairs (source -> target) based on soldier count changes and adjacency
   * Returns a map where key is target region index, value is source region index
   */
  private buildMovementPairs(newState: any, previousState: any): Map<number, number> {
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};
    const newOwners = newState.ownersByRegion || {};
    const oldOwners = previousState.ownersByRegion || {};
    const regions = newState.regions || [];

    // Find regions that lost soldiers
    const regionsWithLosses: Array<{regionIndex: number, loss: number}> = [];
    // Find regions that gained soldiers
    const regionsWithGains: Array<{regionIndex: number, gain: number, wasConquest: boolean}> = [];

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const owner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];
      const idx = parseInt(regionIndex);

      if (newCount < oldCount && owner !== undefined) {
        // Region lost soldiers (likely source of move)
        regionsWithLosses.push({ regionIndex: idx, loss: oldCount - newCount });
      } else if (newCount > oldCount) {
        // Region gained soldiers (likely target of move)
        const wasConquest = oldOwner !== undefined && oldOwner !== owner;
        regionsWithGains.push({ regionIndex: idx, gain: newCount - oldCount, wasConquest });
      }
    });

    // Try to pair losses with gains based on adjacency
    const pairs = new Map<number, number>();
    const usedSources = new Set<number>();

    for (const gain of regionsWithGains) {
      const targetRegion = regions.find((r: any) => r.index === gain.regionIndex);
      if (!targetRegion) continue;

      // Find the best matching source: a region that lost soldiers and is adjacent
      let bestSource: {regionIndex: number, loss: number} | null = null;
      for (const loss of regionsWithLosses) {
        // Skip if already used
        if (usedSources.has(loss.regionIndex)) continue;

        const sourceRegion = regions.find((r: any) => r.index === loss.regionIndex);
        if (!sourceRegion) continue;

        // Check if regions are adjacent
        const areNeighbors = sourceRegion.neighbors && sourceRegion.neighbors.includes(gain.regionIndex);

        if (areNeighbors) {
          bestSource = loss;
          break; // Found an adjacent source
        }
      }

      // If we found a valid adjacent source, record the pairing
      if (bestSource) {
        usedSources.add(bestSource.regionIndex);
        pairs.set(gain.regionIndex, bestSource.regionIndex);
      }
    }

    return pairs;
  }

  /**
   * Detect region conquests by comparing ownership
   */
  private detectConquests(newState: any, previousState: any, moves: DetectedMove[], movementPairs: Map<number, number>): void {
    const newOwners = newState.ownersByRegion || {};
    const oldOwners = previousState.ownersByRegion || {};
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};

    Object.keys(newOwners).forEach(regionIndex => {
      const newOwner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];
      const idx = parseInt(regionIndex);
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const newCount = (newSoldiers[regionIndex] || []).length;

      // Detect conquests:
      // 1. Enemy territory conquered (oldOwner changed)
      // 2. Neutral territory with defenders conquered (oldOwner undefined but had soldiers)
      const isEnemyConquest = oldOwner !== undefined && newOwner !== oldOwner;
      const isNeutralConquest = oldOwner === undefined && oldCount > 0 && newOwner !== undefined;

      if (isEnemyConquest || isNeutralConquest) {
        const sourceRegion = movementPairs.get(idx); // Get source from movement pairs

        console.log('⚔️ MoveDetector: Conquest detected', {
          regionIndex: idx,
          oldOwner,
          newOwner,
          oldCount,
          newCount,
          sourceRegion,
          isNeutral: isNeutralConquest
        });

        moves.push({
          type: 'conquest',
          regionIndex: idx,
          newOwner,
          oldOwner,
          oldCount, // Starting defender count before battle
          newCount,  // Final soldier count after battle
          sourceRegion // Source region for battle animation
        });
      }
    });
  }

  /**
   * Detect soldier count changes (recruitment or movement)
   */
  private detectSoldierChanges(newState: any, previousState: any, moves: DetectedMove[], movementPairs: Map<number, number>): void {
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};
    const newOwners = newState.ownersByRegion || {};

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const idx = parseInt(regionIndex);

      if (newCount > oldCount && newOwners[regionIndex] === previousState.playerSlotIndex) {
        // Soldiers were recruited (only if same owner)
        moves.push({
          type: 'recruitment',
          regionIndex: idx,
          soldierCount: newCount - oldCount
        });
      } else if (newCount > oldCount) {
        // Soldiers moved into this region - check if we have a source
        const sourceRegion = movementPairs.get(idx);
        moves.push({
          type: 'movement',
          regionIndex: idx,
          oldCount,
          newCount,
          soldierCount: newCount - oldCount, // Calculate actual soldier count for animation
          sourceRegion // Add source for animation
        });
      }
    });
  }

  /**
   * Detect temple upgrades
   */
  private detectTemplateUpgrades(newState: any, previousState: any, moves: DetectedMove[]): void {
    if (!newState.templeUpgrades || !previousState.templeUpgrades) {
      return;
    }

    Object.keys(newState.templeUpgrades).forEach(regionIndex => {
      const newUpgrades = newState.templeUpgrades[regionIndex] || [];
      const oldUpgrades = previousState.templeUpgrades[regionIndex] || [];

      if (newUpgrades.length > oldUpgrades.length) {
        moves.push({
          type: 'upgrade',
          regionIndex: parseInt(regionIndex)
        });
      }
    });
  }
}
