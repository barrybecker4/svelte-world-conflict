import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { DetectedMove } from './MoveDetector';

// Animation duration constants
const MOVEMENT_DURATION = 500;
const RECRUITMENT_DURATION = 1500; // Time for highlight
const UPGRADE_DURATION = 1500; // Time for highlight

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
    // Play movement sound
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

    // If we know the source region, animate soldiers moving
    if (move.sourceRegion !== undefined && gameState) {
      const sourceRegion = move.sourceRegion;
      const targetRegion = move.regionIndex;
      const soldierCount = move.soldierCount || 0;
      
      console.log(`🚶 AI Move: Setting movingToRegion on ${soldierCount} soldiers from ${sourceRegion} to ${targetRegion}`);
      
      // Create a deep copy of game state for animation
      const animationState = JSON.parse(JSON.stringify(gameState));
      const animationSoldiers = animationState.soldiersByRegion?.[sourceRegion] || [];
      
      // Set movingToRegion on the animation state's soldiers
      animationSoldiers.slice(0, soldierCount).forEach((soldier: any) => {
        soldier.movingToRegion = targetRegion;
      });

      // Dispatch animation state update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }
    }

    // Visual feedback
    this.highlightRegion(move.regionIndex, 'movement');

    // Wait for animation to complete
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 700); // Match the CSS transition time
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
      setTimeout(() => resolve(), RECRUITMENT_DURATION);
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
      setTimeout(() => resolve(), UPGRADE_DURATION);
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
          duration: 1500
        }
      }));
    }
  }

}
