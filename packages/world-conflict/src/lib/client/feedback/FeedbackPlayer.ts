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
   */
  async playMovement(move: DetectedMove, gameState: any): Promise<void> {
    if (move.sourceRegion === undefined) {
      audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);
      this.highlightRegion(move.regionIndex, 'movement');
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
      });
      return;
    }

    if (gameState) {
      const sourceRegion = move.sourceRegion;
      const targetRegion = move.regionIndex;
      const soldierCount = move.soldierCount || 0;

      const animationState = JSON.parse(JSON.stringify(gameState));
      const sourceSoldiers = animationState.soldiersByRegion?.[sourceRegion] || [];

      if (sourceSoldiers.length < soldierCount) {
        return;
      }

      // Mark soldiers as moving (server uses pop() from end of array)
      const startIndex = Math.max(0, sourceSoldiers.length - soldierCount);
      for (let i = startIndex; i < sourceSoldiers.length; i++) {
        sourceSoldiers[i].movingToRegion = targetRegion;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('battleStateUpdate', {
          detail: { gameState: animationState }
        }));
      }
    }

    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);
    this.highlightRegion(move.regionIndex, 'movement');

    await new Promise<void>((resolve) => 
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
    });
  }

  /**
   * Play recruitment feedback with sound and visual effects
   */
  async playRecruitment(move: DetectedMove): Promise<void> {
    audioSystem.playSound(SOUNDS.SOLDIERS_RECRUITED);
    this.highlightRegion(move.regionIndex, 'recruitment');
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
    });
  }

  /**
   * Play upgrade feedback with sound and visual effects
   */
  async playUpgrade(move: DetectedMove): Promise<void> {
    audioSystem.playSound(SOUNDS.TEMPLE_UPGRADED);
    this.highlightRegion(move.regionIndex, 'upgrade');
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
    });
  }

  /**
   * Highlight a region with visual feedback
   */
  highlightRegion(regionIndex: number, actionType: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('highlightRegion', {
        detail: { regionIndex, actionType, duration: GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS }
      }));
    }
  }

}
