import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Represents a detected move from comparing game states
 */
interface DetectedMove {
  type: 'conquest' | 'movement' | 'recruitment' | 'upgrade';
  regionIndex: number;
  newOwner?: number;
  oldOwner?: number;
  soldierCount?: number;
  oldCount?: number;
  newCount?: number;
  sourceRegion?: number; // For tracking where soldiers came from
}

/**
 * Handles replay of other players' moves with audio and visual feedback
 * Extracted from gameStateStore to reduce its complexity
 */
export class MoveReplayer {
  private readonly MOVE_PLAYBACK_DELAY = 600; // ms between each move sound/effect

  constructor() {
  }

  /**
   * Main entry point: Play sound effects and show visual feedback for other player moves
   * @param newState - The updated game state
   * @param previousState - The previous game state for comparison
   */
  replayMoves(newState: any, previousState: any): void {
    if (!previousState) {
      console.log('No previous state available for move replay');
      return;
    }

    console.log('Playing other player moves...');

    // Detect what changed between states to determine move types
    const moves = this.detectMovesFromStateDiff(newState, previousState);

    if (moves.length === 0) {
      console.log('No moves detected to replay');
      return;
    }

    console.log(`Replaying ${moves.length} moves:`, moves);

    // Play moves with delays
    moves.forEach((move, index) => {
      setTimeout(() => {
        this.playMoveWithFeedback(move);
      }, index * this.MOVE_PLAYBACK_DELAY);
    });
  }

  /**
   * Detect moves by comparing game states
   * @param newState - The updated game state
   * @param previousState - The previous game state
   * @returns Array of detected moves
   */
  private detectMovesFromStateDiff(newState: any, previousState: any): DetectedMove[] {
    const moves: DetectedMove[] = [];

    // Build adjacency map for pairing movements
    const movementPairs = this.buildMovementPairs(newState, previousState);

    // Check for region ownership changes (conquests)
    this.detectConquests(newState, previousState, moves);

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
      let bestSource = null;
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
  private detectConquests(newState: any, previousState: any, moves: DetectedMove[]): void {
    const newOwners = newState.ownersByRegion || {};
    const oldOwners = previousState.ownersByRegion || {};

    Object.keys(newOwners).forEach(regionIndex => {
      const newOwner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];

      if (oldOwner !== undefined && newOwner !== oldOwner) {
        // Region was conquered
        moves.push({
          type: 'conquest',
          regionIndex: parseInt(regionIndex),
          newOwner,
          oldOwner
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

  /**
   * Play a single move with appropriate sound and visual feedback
   * @param move - The move to play back
   */
  private playMoveWithFeedback(move: DetectedMove): void {
    console.log('Playing move:', move);

    switch (move.type) {
      case 'conquest':
        this.playConquestFeedback(move);
        break;

      case 'movement':
        this.playMovementFeedback(move);
        break;

      case 'recruitment':
        this.playRecruitmentFeedback(move);
        break;

      case 'upgrade':
        this.playUpgradeFeedback(move);
        break;

      default:
        console.log('Unknown move type:', move.type);
    }
  }

  /**
   * Play conquest feedback with multiple sounds and visual highlight
   */
  private playConquestFeedback(move: DetectedMove): void {
    // Play attack and combat sounds
    audioSystem.playSound(SOUNDS.ATTACK);

    setTimeout(() => {
      audioSystem.playSound(SOUNDS.COMBAT);
      // Additional sound for conquest
      setTimeout(() => {
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);
      }, 300);
    }, 200);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'conquest');
  }

  /**
   * Play movement feedback
   */
  private playMovementFeedback(move: DetectedMove): void {
    // Play movement sound
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'movement');
    
    // If we know the source region, trigger movement animation
    if (move.sourceRegion !== undefined) {
      this.dispatchMovementAnimation(move.sourceRegion, move.regionIndex, move.soldierCount || 0);
    }
  }

  /**
   * Play recruitment feedback
   */
  private playRecruitmentFeedback(move: DetectedMove): void {
    // Play recruitment sound
    audioSystem.playSound(SOUNDS.SOLDIERS_RECRUITED);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'recruitment');
  }

  /**
   * Play upgrade feedback
   */
  private playUpgradeFeedback(move: DetectedMove): void {
    // Play upgrade sound
    audioSystem.playSound(SOUNDS.TEMPLE_UPGRADED);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'upgrade');
  }

  /**
   * Highlight a region with visual feedback by dispatching a custom event
   * @param regionIndex - The region to highlight
   * @param actionType - The type of action for styling
   */
  private highlightRegion(regionIndex: number, actionType: string): void {
    // Dispatch custom event for visual highlighting
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('highlightRegion', {
        detail: {
          regionIndex,
          actionType,
          duration: 1500
        }
      }));
    }
  }

  /**
   * Dispatch movement animation event
   * @param sourceRegion - Source region index
   * @param targetRegion - Target region index
   * @param soldierCount - Number of soldiers moving
   */
  private dispatchMovementAnimation(sourceRegion: number, targetRegion: number, soldierCount: number): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('animateMovement', {
        detail: {
          sourceRegion,
          targetRegion,
          soldierCount,
          duration: 500 // Half second animation
        }
      }));
    }
  }

  /**
   * Update playback delay (useful for different game speeds or testing)
   * @param delayMs - Delay in milliseconds between moves
   */
  setPlaybackDelay(delayMs: number): void {
    if (delayMs > 0) {
      (this as any).MOVE_PLAYBACK_DELAY = delayMs;
    }
  }

  /**
   * Get current playback delay
   */
  getPlaybackDelay(): number {
    return this.MOVE_PLAYBACK_DELAY;
  }
}
