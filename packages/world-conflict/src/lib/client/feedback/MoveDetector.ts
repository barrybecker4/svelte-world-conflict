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
  // Context fields for battle animations
  previousGameState?: any;
  finalGameState?: any;
  regions?: any[];
}

/** Region that lost soldiers (potential movement source) */
interface RegionLoss {
  regionIndex: number;
  loss: number;
  owner: number;
}

/** Region that gained soldiers (potential movement target) */
interface RegionGain {
  regionIndex: number;
  gain: number;
  wasConquest: boolean;
  newOwner: number;
  oldOwner?: number;
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
    this.detectTempleUpgrades(newState, previousState, moves);

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

    // Identify source and target regions
    const regionsWithLosses = this.findRegionsWithLosses(newSoldiers, oldSoldiers, newOwners, oldOwners);
    const regionsWithGains = this.findRegionsWithGains(newSoldiers, oldSoldiers, newOwners, oldOwners);

    // Match sources to targets
    return this.matchSourcesAndTargets(regionsWithLosses, regionsWithGains, regions);
  }

  /**
   * Find regions that lost soldiers (potential movement sources)
   * Only tracks losses where ownership didn't change (true source regions, not battle casualties)
   */
  private findRegionsWithLosses(
    newSoldiers: Record<string, any[]>,
    oldSoldiers: Record<string, any[]>,
    newOwners: Record<string, number>,
    oldOwners: Record<string, number>
  ): RegionLoss[] {
    const losses: RegionLoss[] = [];

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const owner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];

      // Only track losses where ownership didn't change
      if (newCount < oldCount && owner !== undefined && owner === oldOwner) {
        losses.push({
          regionIndex: parseInt(regionIndex),
          loss: oldCount - newCount,
          owner
        });
      }
    });

    return losses;
  }

  /**
   * Find regions that gained soldiers (potential movement targets)
   */
  private findRegionsWithGains(
    newSoldiers: Record<string, any[]>,
    oldSoldiers: Record<string, any[]>,
    newOwners: Record<string, number>,
    oldOwners: Record<string, number>
  ): RegionGain[] {
    const gains: RegionGain[] = [];

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const owner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];

      if (newCount > oldCount) {
        const wasConquest = this.isConquest(oldOwner, owner, oldCount, newCount);
        gains.push({
          regionIndex: parseInt(regionIndex),
          gain: newCount - oldCount,
          wasConquest,
          newOwner: owner,
          oldOwner
        });
      }
    });

    return gains;
  }

  /**
   * Match source regions to target regions based on adjacency and ownership
   */
  private matchSourcesAndTargets(
    regionsWithLosses: RegionLoss[],
    regionsWithGains: RegionGain[],
    regions: any[]
  ): Map<number, number> {
    const pairs = new Map<number, number>();
    const remainingLosses = new Map<number, number>();
    
    regionsWithLosses.forEach(loss => {
      remainingLosses.set(loss.regionIndex, loss.loss);
    });

    // Process conquests first (priority over peaceful moves)
    const conquests = regionsWithGains.filter(g => g.wasConquest);
    const peacefulMoves = regionsWithGains.filter(g => !g.wasConquest);
    const orderedGains = [...conquests, ...peacefulMoves];

    for (const gain of orderedGains) {
      const targetRegion = regions.find((r: any) => r.index === gain.regionIndex);
      if (!targetRegion) continue;

      const bestSource = this.findBestSource(gain, regionsWithLosses, remainingLosses, regions);

      if (bestSource) {
        pairs.set(gain.regionIndex, bestSource.regionIndex);
        const remaining = remainingLosses.get(bestSource.regionIndex) || 0;
        remainingLosses.set(bestSource.regionIndex, remaining - gain.gain);
      }
    }

    return pairs;
  }

  /**
   * Find the best matching source for a region gain
   */
  private findBestSource(
    gain: RegionGain,
    regionsWithLosses: RegionLoss[],
    remainingLosses: Map<number, number>,
    regions: any[]
  ): RegionLoss | null {
    for (const loss of regionsWithLosses) {
      const remaining = remainingLosses.get(loss.regionIndex) || 0;
      if (remaining <= 0) continue;

      const sourceRegion = regions.find((r: any) => r.index === loss.regionIndex);
      if (!sourceRegion) continue;

      // Check adjacency
      const areNeighbors = sourceRegion.neighbors?.includes(gain.regionIndex);
      if (!areNeighbors) continue;

      // Check ownership: source owner must match new owner of target
      if (loss.owner === gain.newOwner) {
        return loss;
      }
    }
    return null;
  }

  /**
   * Check if a region change represents a conquest
   * Covers: enemy territory, neutral with defenders, empty neutral
   */
  private isConquest(
    oldOwner: number | undefined,
    newOwner: number | undefined,
    oldCount: number,
    newCount: number
  ): boolean {
    const isEnemyConquest = oldOwner !== undefined && newOwner !== oldOwner;
    const isNeutralConquest = oldOwner === undefined && oldCount > 0 && newOwner !== undefined;
    const isEmptyNeutralConquest = oldOwner === undefined && oldCount === 0 && newCount > 0;
    return isEnemyConquest || isNeutralConquest || isEmptyNeutralConquest;
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

      if (this.isConquest(oldOwner, newOwner, oldCount, newCount)) {
        const sourceRegion = movementPairs.get(idx);

        moves.push({
          type: 'conquest',
          regionIndex: idx,
          newOwner,
          oldOwner,
          oldCount,
          newCount,
          sourceRegion
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
    const oldOwners = previousState.ownersByRegion || {};

    // Build set of conquered regions to avoid detecting them as movements
    const conqueredRegions = new Set<number>();
    moves.forEach(move => {
      if (move.type === 'conquest') {
        conqueredRegions.add(move.regionIndex);
      }
    });

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      const idx = parseInt(regionIndex);

      // Skip if this region was conquered - conquest animation handles everything
      if (conqueredRegions.has(idx)) {
        return;
      }

      if (newCount > oldCount && newOwners[regionIndex] === previousState.playerSlotIndex) {
        // Soldiers were recruited (only if same owner)
        moves.push({
          type: 'recruitment',
          regionIndex: idx,
          soldierCount: newCount - oldCount
        });
      } else if (newCount > oldCount) {
        // Soldiers moved into this region (peaceful move) - check if we have a source
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
  private detectTempleUpgrades(newState: any, previousState: any, moves: DetectedMove[]): void {
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
