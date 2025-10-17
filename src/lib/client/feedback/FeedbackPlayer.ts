import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { DetectedMove } from './MoveDetector';

/**
 * Plays simple audio and visual feedback for game moves
 * Extracted from MoveReplayer to separate simple feedback from complex battle animations
 */
export class FeedbackPlayer {
  /**
   * Play movement feedback with sound and visual effects
   */
  playMovement(move: DetectedMove): void {
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
   * Play recruitment feedback with sound and visual effects
   */
  playRecruitment(move: DetectedMove): void {
    // Play recruitment sound
    audioSystem.playSound(SOUNDS.SOLDIERS_RECRUITED);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'recruitment');
  }

  /**
   * Play upgrade feedback with sound and visual effects
   */
  playUpgrade(move: DetectedMove): void {
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
  highlightRegion(regionIndex: number, actionType: string): void {
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
}

