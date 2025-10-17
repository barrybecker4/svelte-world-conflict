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
   */
  async playConquest(move: DetectedMove, regions: any[]): Promise<void> {
    console.log('🎯 BattleReplayCoordinator.playConquest called:', {
      hasAttackSequence: !!move.attackSequence,
      attackSequenceLength: move.attackSequence?.length || 0,
      hasBattleAnimationSystem: !!this.battleAnimationSystem,
      regionsCount: regions.length,
      regionIndex: move.regionIndex
    });

    // If we have an attack sequence and battle animation system, play full battle animation
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      console.log('🎬 Playing blow-by-blow battle animation for conquest');
      
      try {
        // Need to get the previous state to know starting soldier counts
        // For replays, we need to store this information
        const sourceRegion = move.sourceRegion !== undefined ? move.sourceRegion : 0;
        const targetRegion = move.regionIndex;
        
        console.log('🎯 Battle animation setup:', {
          sourceRegion,
          targetRegion,
          hasSourceRegion: move.sourceRegion !== undefined
        });
        
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
        this.playSimpleConquestFeedback();
      }
    } else {
      // Fallback to simple conquest feedback
      this.playSimpleConquestFeedback();
    }

    // Visual feedback
    this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');
  }

  /**
   * Simple conquest feedback without blow-by-blow animation
   */
  private playSimpleConquestFeedback(): void {
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
}

