import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { DetectedMove } from './MoveDetector';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Plays simple audio and visual feedback for game moves
 * Extracted from MoveReplayer to separate simple feedback from complex battle animations
 */
export class FeedbackPlayer {
  /**
   * Play movement feedback with sound and visual effects
   * @returns Promise that resolves after animation completes
   */
  async playMovement(move: DetectedMove, gameState: any): Promise<void> {
    console.log(`🚶 Move replay: ${move.soldierCount} soldiers moving from ${move.sourceRegion} to ${move.regionIndex}`);

    // If we know the source region, animate the movement
    if (move.sourceRegion !== undefined && gameState) {
      const sourceRegion = move.sourceRegion;
      const targetRegion = move.regionIndex;
      const soldierCount = move.soldierCount || 0;
      
      // Create animation state: Mark soldiers as moving (keep at source for same DOM elements)
      const animationState = JSON.parse(JSON.stringify(gameState));
      const sourceSoldiers = animationState.soldiersByRegion?.[sourceRegion] || [];
      
      // VALIDATION: Ensure we have enough soldiers at source
      if (sourceSoldiers.length < soldierCount) {
        console.error(`❌ Invalid animation state: trying to move ${soldierCount} soldiers but only ${sourceSoldiers.length} at source region ${sourceRegion}`);
        console.error('This indicates the gameState was contaminated with animation state from a previous move');
        // Skip animation if state is invalid - the final state will still be applied correctly
        return;
      }
      
      // Mark soldiers as moving (they stay in source array for rendering)
      // IMPORTANT: Server uses pop() which takes from END of array, so mark the LAST N soldiers
      const startIndex = Math.max(0, sourceSoldiers.length - soldierCount);
      for (let i = startIndex; i < sourceSoldiers.length; i++) {
        sourceSoldiers[i].movingToRegion = targetRegion;
      }
      
      // Apply animation state
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }
    }

    // Play movement sound
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'movement');

    // Wait for CSS transition to complete
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
    });
  }

  /**
   * Play recruitment feedback with sound and visual effects
   * @returns Promise that resolves after animation completes
   */
  async playRecruitment(move: DetectedMove): Promise<void> {
    // Play recruitment sound
    audioSystem.playSound(SOUNDS.SOLDIERS_RECRUITED);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'recruitment');

    // Wait for highlight duration
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
    });
  }

  /**
   * Play upgrade feedback with sound and visual effects
   * @returns Promise that resolves after animation completes
   */
  async playUpgrade(move: DetectedMove): Promise<void> {
    // Play upgrade sound
    audioSystem.playSound(SOUNDS.TEMPLE_UPGRADED);

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'upgrade');

    // Wait for highlight duration
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
    });
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
          duration: GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS
        }
      }));
    }
  }

}
