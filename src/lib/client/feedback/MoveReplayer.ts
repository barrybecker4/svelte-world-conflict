import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';

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
  attackSequence?: any[]; // Battle animation sequence for replay
}

/**
 * Handles replay of other players' moves with audio and visual feedback
 * Extracted from gameStateStore to reduce its complexity
 */
export class MoveReplayer {
  private readonly MOVE_PLAYBACK_DELAY = 600; // ms between each move sound/effect
  private battleAnimationSystem: BattleAnimationSystem | null = null;

  constructor() {
  }

  /**
   * Set the battle animation system for playing battle sequences
   */
  setBattleAnimationSystem(system: BattleAnimationSystem): void {
    this.battleAnimationSystem = system;
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

    // Extract attack sequence and regions from new state if available
    const attackSequence = newState.attackSequence;
    const regions = newState.regions || [];

    // Detect what changed between states to determine move types
    const moves = this.detectMovesFromStateDiff(newState, previousState);

    // Attach attack sequence and regions to conquest moves if available
    if (attackSequence && moves.length > 0) {
      const conquestMove = moves.find(m => m.type === 'conquest');
      if (conquestMove) {
        conquestMove.attackSequence = attackSequence;
        (conquestMove as any).regions = regions; // Attach regions for animation
      }
    }

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
  private detectConquests(newState: any, previousState: any, moves: DetectedMove[]): void {
    const newOwners = newState.ownersByRegion || {};
    const oldOwners = previousState.ownersByRegion || {};
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};

    Object.keys(newOwners).forEach(regionIndex => {
      const newOwner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];

      if (oldOwner !== undefined && newOwner !== oldOwner) {
        // Region was conquered - capture starting defender count for animation
        const idx = parseInt(regionIndex);
        const oldCount = (oldSoldiers[regionIndex] || []).length;
        const newCount = (newSoldiers[regionIndex] || []).length;
        
        moves.push({
          type: 'conquest',
          regionIndex: idx,
          newOwner,
          oldOwner,
          oldCount, // Starting defender count before battle
          newCount  // Final soldier count after battle
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
   * If attack sequence is available, play blow-by-blow battle animation
   */
  private async playConquestFeedback(move: DetectedMove): Promise<void> {
    // If we have an attack sequence and battle animation system, play full battle animation
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      console.log('🎬 Playing blow-by-blow battle animation for conquest');
      
      try {
        // Get regions from the move object (attached during replayMoves)
        const regions = (move as any).regions || [];
        
        // Need to get the previous state to know starting soldier counts
        // For replays, we need to store this information
        const sourceRegion = move.sourceRegion || 0;
        const targetRegion = move.regionIndex;
        
        // Initialize battle animation with starting counts and ownership from BEFORE the current state
        if (typeof window !== 'undefined' && move.oldCount !== undefined && move.oldOwner !== undefined) {
          // For AI/multiplayer battles being replayed, oldCount is the starting defender count
          const startingTargetCount = move.oldCount;
          const targetOwner = move.oldOwner; // Original owner before conquest
          
          console.log(`🎬 Initializing replay battle animation - Target ${targetRegion}: ${startingTargetCount}, Owner: ${targetOwner}`);
          
          window.dispatchEvent(new CustomEvent('battleAnimationStart', {
            detail: {
              sourceRegion,
              targetRegion,
              sourceCount: 0, // Will be updated by first round
              targetCount: startingTargetCount,
              targetOwner: targetOwner
            }
          }));
        }
        
        // Create state update callback for real-time soldier count updates
        const stateUpdateCallback = (attackerLosses: number, defenderLosses: number) => {
          // Dispatch event to update UI
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('battleRoundUpdate', {
              detail: {
                sourceRegion,
                targetRegion,
                attackerLosses,
                defenderLosses
              }
            }));
          }
        };
        
        await this.battleAnimationSystem.playAttackSequence(move.attackSequence, regions, stateUpdateCallback);
        
        // Dispatch battle complete event to clear animation overrides
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('battleComplete'));
        }
        
        // Play conquest sound at the end
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);
      } catch (error) {
        console.error('Failed to play battle animation, falling back to simple feedback:', error);
        this.playSimpleConquestFeedback(move);
      }
    } else {
      // Fallback to simple conquest feedback
      this.playSimpleConquestFeedback(move);
    }

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'conquest');
  }

  /**
   * Simple conquest feedback without blow-by-blow animation
   */
  private playSimpleConquestFeedback(move: DetectedMove): void {
    // Play attack and combat sounds
    audioSystem.playSound(SOUNDS.ATTACK);

    setTimeout(() => {
      audioSystem.playSound(SOUNDS.COMBAT);
      // Additional sound for conquest
      setTimeout(() => {
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);
      }, 300);
    }, 200);
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
