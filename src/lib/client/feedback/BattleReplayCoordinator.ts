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

        // Get game states from move (attached by MoveReplayer)
        const previousGameState = (move as any).previousGameState;
        const finalGameState = (move as any).finalGameState;

        let animationState: any = null;

        if (previousGameState && previousGameState.soldiersByRegion) {
          // Create a deep copy of game state for animation (to avoid mutating the original)
          animationState = JSON.parse(JSON.stringify(previousGameState));

          // Set attackedRegion on attacking soldiers (for halfway positioning)
          const attackingSoldiers = animationState.soldiersByRegion[sourceRegion] || [];
          console.log(`⚔️ AI Battle: Setting attackedRegion on ${attackingSoldiers.length} soldiers from region ${sourceRegion}`);

          attackingSoldiers.forEach((soldier: any) => {
            soldier.attackedRegion = targetRegion;
          });

          // Trigger state update to show halfway positioning
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('battleStateUpdate', {
              detail: { gameState: animationState }
            }));
          }

          // Wait for soldiers to move halfway
          await new Promise(resolve => setTimeout(resolve, 700));
        }

        // Play the full battle animation sequence with casualty callbacks for smoke
        const onStateUpdate = (attackerCasualties: number, defenderCasualties: number) => {
          // Dispatch event to spawn smoke particles
          if (typeof window !== 'undefined' && (attackerCasualties > 0 || defenderCasualties > 0)) {
            window.dispatchEvent(new CustomEvent('battleCasualties', {
              detail: {
                sourceRegion,
                targetRegion,
                attackerCasualties,
                defenderCasualties
              }
            }));
          }
        };

        await this.battleAnimationSystem.playAttackSequence(move.attackSequence, regions, onStateUpdate);

        // Wait for smoke animations to complete (matching BattleManager timing)
        console.log('⏳ Waiting for smoke effects to complete...');
        await new Promise(resolve => setTimeout(resolve, 2500));
        console.log('✅ Smoke effects complete');

        // Animate surviving attackers moving into the conquered region
        // Ownership is updated as part of the animation state
        if (finalGameState && animationState) {
          console.log('🏃 Animating conquering soldiers into target region...');
          await this.animateConqueringMove(animationState, finalGameState, sourceRegion, targetRegion);
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
   * Animate conquering soldiers moving into the conquered region
   * (Matches the logic from BattleManager.animateConqueringMove)
   * @returns true if conquest was successful, false otherwise
   */
  private async animateConqueringMove(
    previousGameState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<boolean> {
    // Check if conquest was successful by seeing if there are attackers at target
    const targetSoldiersInFinal = finalGameState.soldiersByRegion?.[targetRegion] || [];
    const sourceOwner = finalGameState.ownersByRegion?.[sourceRegion];
    const targetOwner = finalGameState.ownersByRegion?.[targetRegion];

    // Only animate if conquest successful
    const conquestSuccessful = targetSoldiersInFinal.length > 0 && sourceOwner === targetOwner;

    if (!conquestSuccessful) {
      console.log('⚔️ Attack failed or no survivors, skipping conquest animation');
      return false;
    }

    console.log(`🏆 Conquest successful! Animating ${targetSoldiersInFinal.length} soldiers into region ${targetRegion}`);

    // Create new animation state with survivors still at source
    const newAnimationState = JSON.parse(JSON.stringify(finalGameState));

    // Get the soldier IDs that survived (now at target in final state)
    const survivorIds = new Set(targetSoldiersInFinal.map((s: any) => s.i));

    // Get soldiers currently at source with attackedRegion
    const currentSourceSoldiers = previousGameState.soldiersByRegion?.[sourceRegion] || [];

    // Find the attacking soldiers that survived (match IDs)
    const survivingAttackers = currentSourceSoldiers.filter((s: any) =>
      s.attackedRegion === targetRegion && survivorIds.has(s.i)
    );

    console.log(`Found ${survivingAttackers.length} surviving attackers to animate (out of ${targetSoldiersInFinal.length} total)`);

    // Place survivors at source with movingToRegion set
    newAnimationState.soldiersByRegion[sourceRegion] = survivingAttackers.map((s: any) => ({
      ...s,
      attackedRegion: undefined,
      movingToRegion: targetRegion
    }));

    // Clear target region (soldiers will animate there)
    newAnimationState.soldiersByRegion[targetRegion] = [];

    // Update ownership in animation state so color changes with soldiers
    newAnimationState.ownersByRegion = {
      ...newAnimationState.ownersByRegion,
      [targetRegion]: finalGameState.ownersByRegion[targetRegion]
    };

    // Dispatch animation state update (includes ownership change)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('battleStateUpdate', {
        detail: { gameState: newAnimationState }
      }));
    }

    // Wait for CSS transition to complete (soldiers moving from halfway to target)
    await new Promise(resolve => setTimeout(resolve, 700));
    console.log('✅ Conquering soldiers reached target region');

    return true;
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
