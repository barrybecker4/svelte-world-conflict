import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

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
    console.log(`⚔️ BattleReplayCoordinator.playConquest`, {
      hasAttackSequence: !!move.attackSequence,
      attackSequenceLength: move.attackSequence?.length || 0,
      hasBattleAnimationSystem: !!this.battleAnimationSystem,
      sourceRegion: move.sourceRegion,
      targetRegion: move.regionIndex
    });
    
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      console.log(`✅ Playing full battle animation`);
      await this.playFullBattleAnimation(move, regions);
    } else {
      console.log(`⚠️ Playing simple conquest feedback (no attack sequence or battle system)`, {
        hasAttackSequence: !!move.attackSequence,
        hasBattleSystem: !!this.battleAnimationSystem
      });
      await this.playSimpleConquestFeedback(move);
    }
  }

  /**
   * Play full blow-by-blow battle animation with casualties
   */
  private async playFullBattleAnimation(move: DetectedMove, regions: any[]): Promise<void> {
    const sourceRegion = move.sourceRegion !== undefined ? move.sourceRegion : 0;
    const targetRegion = move.regionIndex;
    const previousGameState = (move as any).previousGameState;
    const finalGameState = (move as any).finalGameState;

    // Calculate how many soldiers actually attacked by comparing states
    const previousSourceCount = previousGameState.soldiersByRegion?.[sourceRegion]?.length || 0;
    const finalSourceCount = finalGameState.soldiersByRegion?.[sourceRegion]?.length || 0;
    const attackingSoldierCount = previousSourceCount - finalSourceCount;

    console.log(`⚔️ Battle replay: ${attackingSoldierCount} soldiers attacked (${previousSourceCount} before, ${finalSourceCount} after at source)`);

    // Step 1: Set up halfway positioning for attacking soldiers
    const animationState = await this.prepareAttackAnimation(
      previousGameState,
      sourceRegion,
      targetRegion,
      attackingSoldierCount
    );

    // Step 2: Play battle sequence with casualty effects
    await this.playBattleSequenceWithEffects(
      move.attackSequence!,
      regions,
      sourceRegion,
      targetRegion
    );

    // Step 3: Animate conquest completion
    await this.completeConquest(animationState, finalGameState, sourceRegion, targetRegion);

    // Step 4: Final feedback
    this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');
    await new Promise<void>((resolve) =>
      setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS)
    );
  }

  /**
   * Prepare animation state with soldiers positioned halfway to target
   */
  private async prepareAttackAnimation(
    previousGameState: any,
    sourceRegion: number,
    targetRegion: number,
    attackingSoldierCount: number
  ): Promise<any> {
    if (!previousGameState || !previousGameState.soldiersByRegion) {
      return null;
    }

    // Create a deep copy of game state for animation
    const animationState = JSON.parse(JSON.stringify(previousGameState));

    // Set attackedRegion on attacking soldiers (for halfway positioning)
    const soldierArray = animationState.soldiersByRegion[sourceRegion] || [];

    // Mark ONLY the soldiers that are attacking (they stay in source array for rendering)
    // Server uses pop() which takes from END of array, so mark the LAST N soldiers
    const startIndex = Math.max(0, soldierArray.length - attackingSoldierCount);
    console.log(
      `⚔️ Battle animation: Marking ${attackingSoldierCount} soldiers (indices ${startIndex}-${soldierArray.length - 1}) as attacking from region ${sourceRegion} to ${targetRegion}`
    );

    for (let i = startIndex; i < soldierArray.length; i++) {
      soldierArray[i].attackedRegion = targetRegion;
    }

    console.log(`✅ Soldiers at source: ${startIndex} staying, ${attackingSoldierCount} attacking`);

    // Trigger state update to show halfway positioning
    this.dispatchBattleStateUpdate(animationState);

    // Wait for soldiers to move halfway
    await new Promise((resolve) =>
      setTimeout(resolve, GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS)
    );

    return animationState;
  }

  /**
   * Play battle sequence with casualty smoke effects
   */
  private async playBattleSequenceWithEffects(
    attackSequence: any[],
    regions: any[],
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    // Callback to dispatch casualty events for smoke particles
    const onCasualties = (attackerCasualties: number, defenderCasualties: number) => {
      if (typeof window !== 'undefined' && (attackerCasualties > 0 || defenderCasualties > 0)) {
        window.dispatchEvent(
          new CustomEvent('battleCasualties', {
            detail: {
              sourceRegion,
              targetRegion,
              attackerCasualties,
              defenderCasualties
            }
          })
        );
      }
    };

    await this.battleAnimationSystem!.playAttackSequence(attackSequence, regions, onCasualties);

    // Wait for smoke animations to complete
    console.log('⏳ Waiting for smoke effects to complete...');
    await new Promise((resolve) => setTimeout(resolve, GAME_CONSTANTS.BATTLE_END_WAIT_MS));
    console.log('✅ Smoke effects complete');
  }

  /**
   * Complete the conquest by animating survivors and playing sound
   */
  private async completeConquest(
    animationState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    if (finalGameState && animationState) {
      console.log('🏃 Animating conquering soldiers into target region...');
      await this.animateConqueringMove(animationState, finalGameState, sourceRegion, targetRegion);
    }

    // Play conquest sound at the end
    audioSystem.playSound(SOUNDS.REGION_CONQUERED);
  }

  /**
   * Helper to dispatch battle state updates
   */
  private dispatchBattleStateUpdate(gameState: any): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('battleStateUpdate', {
          detail: { gameState }
        })
      );
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
    if (!this.isConquestSuccessful(finalGameState, sourceRegion, targetRegion)) {
      console.log('⚔️ Attack failed or no survivors, skipping conquest animation');
      return false;
    }

    const targetSoldiersInFinal = finalGameState.soldiersByRegion?.[targetRegion] || [];
    console.log(
      `🏆 Conquest successful! Animating ${targetSoldiersInFinal.length} soldiers into region ${targetRegion}`
    );

    const newAnimationState = this.buildConquestAnimationState(
      previousGameState,
      finalGameState,
      sourceRegion,
      targetRegion,
      targetSoldiersInFinal
    );

    // Dispatch animation state update (includes ownership change)
    this.dispatchBattleStateUpdate(newAnimationState);

    // Wait for CSS transition to complete
    await new Promise((resolve) =>
      setTimeout(resolve, GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS)
    );
    console.log('✅ Conquering soldiers reached target region');

    return true;
  }

  /**
   * Check if the conquest was successful
   */
  private isConquestSuccessful(
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): boolean {
    const targetSoldiers = finalGameState.soldiersByRegion?.[targetRegion] || [];
    const sourceOwner = finalGameState.ownersByRegion?.[sourceRegion];
    const targetOwner = finalGameState.ownersByRegion?.[targetRegion];

    return targetSoldiers.length > 0 && sourceOwner === targetOwner;
  }

  /**
   * Build animation state for conquest movement
   * This must ensure no duplicate soldier IDs across regions
   */
  private buildConquestAnimationState(
    previousGameState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number,
    targetSoldiersInFinal: any[]
  ): any {
    const newAnimationState = JSON.parse(JSON.stringify(finalGameState));

    console.log(`🔍 buildConquestAnimationState: Building animation for conquest from ${sourceRegion} to ${targetRegion}`);
    console.log(`   Target has ${targetSoldiersInFinal.length} soldiers in final state:`, targetSoldiersInFinal.map((s: any) => s.i));

    // Use finalGameState as source of truth for soldier data
    // In finalGameState: soldiers at source = stayed, soldiers at target = survivors
    const soldiersThatStayed = finalGameState.soldiersByRegion?.[sourceRegion] || [];
    const survivors = targetSoldiersInFinal; // Already have these

    console.log(`   🏠 Soldiers that stayed at source (${soldiersThatStayed.length}):`, soldiersThatStayed.map((s: any) => s.i));
    console.log(`   ✅ Survivors to animate to target (${survivors.length}):`, survivors.map((s: any) => s.i));

    // CRITICAL: Clear target region FIRST to avoid duplicates
    newAnimationState.soldiersByRegion[targetRegion] = [];

    // Place survivors at source with movingToRegion marker so they animate to target
    // Use clean soldier data from finalGameState
    const survivorsMoving = survivors.map((s: any) => ({
      ...s,
      movingToRegion: targetRegion
    }));
    
    // Combine soldiers that stayed with survivors that are moving
    // All soldiers use data from finalGameState (correct state, no stale markers)
    newAnimationState.soldiersByRegion[sourceRegion] = [
      ...soldiersThatStayed,  // Already correct from finalGameState
      ...survivorsMoving      // From finalGameState.target, with movingToRegion added
    ];

    // Update ownership so color changes with soldiers
    newAnimationState.ownersByRegion = {
      ...newAnimationState.ownersByRegion,
      [targetRegion]: finalGameState.ownersByRegion[targetRegion]
    };

    return newAnimationState;
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
        }, GAME_CONSTANTS.QUICK_ANIMATION_MS);
      }, 200);
    });

    // Visual feedback highlight
    this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');

    // Wait for highlight to show
    await new Promise<void>((resolve) => setTimeout(() => resolve(), GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS));
  }
}
