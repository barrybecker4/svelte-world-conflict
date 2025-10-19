import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';

/**
 * Coordinates battle replay animations and sound effects
 * Extracted from MoveReplayer to separate complex battle animation logic
 */
export class BattleReplayCoordinator {
  private battleAnimationSystem: BattleAnimationSystem | null = null;
  private feedbackPlayer: FeedbackPlayer;

  constructor(feedbackPlayer: FeedbackPlayer) {
    this.feedbackPlayer = feedbackPlayer;
  }

  /**
   * Set the battle animation system for playing battle sequences
   */
  setBattleAnimationSystem(system: BattleAnimationSystem): void {
    this.battleAnimationSystem = system;
  }

  /**
   * Play conquest feedback with multiple sounds and visual highlight
   * If attack sequence is available, play blow-by-blow battle animation
   * @returns Promise that resolves when all animations complete
   */
  async playConquest(move: DetectedMove, regions: any[]): Promise<void> {
    // If we have an attack sequence and battle animation system, play full battle animation
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      try {
        const sourceRegion = move.sourceRegion !== undefined ? move.sourceRegion : 0;
        const targetRegion = move.regionIndex;

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

        // Play the full battle animation sequence
        await this.battleAnimationSystem.playAttackSequence(move.attackSequence, regions, stateUpdateCallback);

        // Dispatch battle complete event to clear animation overrides
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('battleComplete'));
        }

        // Play conquest sound at the end
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);

        // Visual feedback highlight
        this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');
        
        // Wait for highlight to show (1500ms as per FeedbackPlayer's highlight duration)
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
      } catch (error) {
        console.error('Failed to play battle animation, falling back to simple feedback:', error);
        await this.playSimpleConquestFeedback(move);
      }
    } else {
      // Fallback to simple conquest feedback
      await this.playSimpleConquestFeedback(move);
    }
  }

  /**
   * Simple conquest feedback without blow-by-blow animation
   * @returns Promise that resolves when feedback completes
   */
  private async playSimpleConquestFeedback(move: DetectedMove): Promise<void> {
    // Play attack and combat sounds with timing
    audioSystem.playSound(SOUNDS.ATTACK);

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        audioSystem.playSound(SOUNDS.COMBAT);
        // Additional sound for conquest
        setTimeout(() => {
          audioSystem.playSound(SOUNDS.REGION_CONQUERED);
          resolve();
        }, 300);
      }, 200);
    });

    // Visual feedback highlight
    this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');
    
    // Wait for highlight to show
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
  }
}
