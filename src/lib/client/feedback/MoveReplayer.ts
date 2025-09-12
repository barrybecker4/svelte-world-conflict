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

    // Check for region ownership changes (conquests)
    this.detectConquests(newState, previousState, moves);

    // Check for soldier count changes (recruitment or movement)
    this.detectSoldierChanges(newState, previousState, moves);

    // Check for temple upgrades
    this.detectTemplateUpgrades(newState, previousState, moves);

    return moves;
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
  private detectSoldierChanges(newState: any, previousState: any, moves: DetectedMove[]): void {
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};
    const newOwners = newState.ownersByRegion || {};

    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;

      if (newCount > oldCount && newOwners[regionIndex] === previousState.playerIndex) {
        // Soldiers were recruited (only if same owner)
        moves.push({
          type: 'recruitment',
          regionIndex: parseInt(regionIndex),
          soldierCount: newCount - oldCount
        });
      } else if (newCount !== oldCount) {
        // Soldiers moved
        moves.push({
          type: 'movement',
          regionIndex: parseInt(regionIndex),
          oldCount,
          newCount
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
