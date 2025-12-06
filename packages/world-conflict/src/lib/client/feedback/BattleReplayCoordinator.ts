import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { delay, waitForNextFrame, dispatchGameEvent } from './utils';

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
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      await this.playFullBattleAnimation(move, regions);
    } else {
      await this.playSimpleConquestFeedback(move);
    }
  }

  /**
   * Play full blow-by-blow battle animation with casualties
   */
  private async playFullBattleAnimation(move: DetectedMove, regions: any[]): Promise<void> {
    const sourceRegion = move.sourceRegion !== undefined ? move.sourceRegion : 0;
    const targetRegion = move.regionIndex;
    const previousGameState = move.previousGameState;
    const finalGameState = move.finalGameState;

    // Calculate how many soldiers actually attacked
    const finalTargetCount = finalGameState.soldiersByRegion?.[targetRegion]?.length || 0;
    let attackingSoldierCount = 0;
    
    if (move.attackSequence && move.attackSequence.length > 0) {
      // Sum casualties to calculate initial attacker count
      let totalAttackerCasualties = 0;
      for (const event of move.attackSequence) {
        totalAttackerCasualties += event.attackerCasualties || 0;
      }
      attackingSoldierCount = finalTargetCount + totalAttackerCasualties;
    } else {
      // Fallback: use state comparison
      const previousSourceCount = previousGameState.soldiersByRegion?.[sourceRegion]?.length || 0;
      const finalSourceCount = finalGameState.soldiersByRegion?.[sourceRegion]?.length || 0;
      attackingSoldierCount = Math.max(0, previousSourceCount - finalSourceCount);
    }

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
    await delay(GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
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

    const animationState = JSON.parse(JSON.stringify(previousGameState));
    const soldierArray = animationState.soldiersByRegion[sourceRegion] || [];

    // Mark attacking soldiers (server uses pop() from end of array)
    const startIndex = Math.max(0, soldierArray.length - attackingSoldierCount);
    for (let i = startIndex; i < soldierArray.length; i++) {
      soldierArray[i].attackedRegion = targetRegion;
    }

    this.dispatchBattleStateUpdate(animationState);

    // Wait for halfway animation to complete
    await waitForNextFrame();
    await delay(GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);

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
    const onCasualties = (attackerCasualties: number, defenderCasualties: number) => {
      if (typeof window !== 'undefined' && (attackerCasualties > 0 || defenderCasualties > 0)) {
        window.dispatchEvent(
          new CustomEvent('battleCasualties', {
            detail: { sourceRegion, targetRegion, attackerCasualties, defenderCasualties }
          })
        );
      }
    };

    await this.battleAnimationSystem!.playAttackSequence(attackSequence, regions, onCasualties);
    await delay(GAME_CONSTANTS.BATTLE_END_WAIT_MS);
  }

  /**
   * Complete the conquest by animating survivors from halfway to target
   * Survivors continue from their halfway position (attackedRegion) to the target (movingToRegion)
   */
  private async completeConquest(
    animationState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    if (finalGameState && animationState) {
      const wasSuccessful = this.isConquestSuccessful(finalGameState, sourceRegion, targetRegion);
      
      if (!wasSuccessful) {
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);
        return;
      }
      
      // Animate survivors from halfway (attackedRegion) to target (movingToRegion)
      // No clearBattlefield needed - soldiers continue from their current halfway position
      await this.animateSurvivorsToTarget(animationState, finalGameState, sourceRegion, targetRegion);
    }

    audioSystem.playSound(SOUNDS.REGION_CONQUERED);
  }

  /**
   * Animate surviving attackers from their halfway position to the target
   * Changes attackedRegion to movingToRegion to continue the animation
   */
  private async animateSurvivorsToTarget(
    animationState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    const survivors = finalGameState.soldiersByRegion?.[targetRegion] || [];
    const survivorIds = new Set(survivors.map((s: any) => s.i));

    // Build state where survivors continue from halfway (change attackedRegion to movingToRegion)
    const continueState = JSON.parse(JSON.stringify(animationState));
    const sourceSoldiers = continueState.soldiersByRegion[sourceRegion] || [];

    // Update soldiers: survivors get movingToRegion, dead attackers are removed
    continueState.soldiersByRegion[sourceRegion] = sourceSoldiers
      .filter((s: any) => {
        // Keep soldiers not attacking OR survivors
        return !s.attackedRegion || survivorIds.has(s.i);
      })
      .map((s: any) => {
        if (s.attackedRegion === targetRegion && survivorIds.has(s.i)) {
          // Survivor: change from attackedRegion (halfway) to movingToRegion (continue to target)
          return { ...s, attackedRegion: undefined, movingToRegion: targetRegion };
        }
        // Non-attacking soldier stays as is
        return { ...s, attackedRegion: undefined, movingToRegion: undefined };
      });

    // Clear target - survivors are animating there from source
    continueState.soldiersByRegion[targetRegion] = [];

    // Update ownership to show conquest
    continueState.ownersByRegion = {
      ...continueState.ownersByRegion,
      [targetRegion]: finalGameState.ownersByRegion[targetRegion]
    };

    this.dispatchBattleStateUpdate(continueState);

    await waitForNextFrame();
    await delay(GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
  }

  /**
   * Helper to dispatch battle state updates
   */
  private dispatchBattleStateUpdate(gameState: any): void {
    dispatchGameEvent('battleStateUpdate', { gameState });
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
    const targetOwner = finalGameState.ownersByRegion?.[targetRegion];
    return targetSoldiers.length > 0 && targetOwner !== undefined;
  }

  /**
   * Simple conquest feedback without blow-by-blow animation
   */
  private async playSimpleConquestFeedback(move: DetectedMove): Promise<void> {
    if (move.sourceRegion !== undefined) {
      // Use the soldier count from the move metadata if available
      const soldierCount = move.soldierCount || (move.newCount || 1) - (move.oldCount || 0);
      const movementMove = {
        type: 'movement' as const,
        regionIndex: move.regionIndex,
        oldCount: move.oldCount || 0,
        newCount: move.newCount || soldierCount,
        soldierCount: soldierCount,
        sourceRegion: move.sourceRegion
      };
      await this.feedbackPlayer.playMovement(movementMove, move.previousGameState);
    }

    audioSystem.playSound(SOUNDS.ATTACK);
    await delay(200);
    audioSystem.playSound(SOUNDS.COMBAT);
    await delay(GAME_CONSTANTS.QUICK_ANIMATION_MS);
    audioSystem.playSound(SOUNDS.REGION_CONQUERED);

    this.feedbackPlayer.highlightRegion(move.regionIndex, 'conquest');
    await delay(GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
  }

  /**
   * Play failed attack (retreat) animation
   * Shows attackers moving halfway, battle with casualties, then survivors retreating back to source
   */
  async playFailedAttack(move: DetectedMove, regions: any[]): Promise<void> {
    if (move.attackSequence && move.attackSequence.length > 0 && this.battleAnimationSystem) {
      await this.playFullRetreatAnimation(move, regions);
    } else {
      await this.playSimpleRetreatFeedback(move);
    }
  }

  /**
   * Play full blow-by-blow retreat animation with casualties
   */
  private async playFullRetreatAnimation(move: DetectedMove, regions: any[]): Promise<void> {
    const sourceRegion = move.sourceRegion !== undefined ? move.sourceRegion : move.regionIndex;
    const targetRegion = move.targetRegion !== undefined ? move.targetRegion : 0;
    const previousGameState = move.previousGameState;
    const finalGameState = move.finalGameState;

    // Calculate how many soldiers actually attacked
    let attackingSoldierCount = 0;
    
    if (move.attackSequence && move.attackSequence.length > 0) {
      // Sum attacker casualties to estimate initial count
      let totalAttackerCasualties = 0;
      for (const event of move.attackSequence) {
        totalAttackerCasualties += event.attackerCasualties || 0;
      }
      // Survivors are those still at source after retreat
      const finalSourceCount = finalGameState?.soldiersByRegion?.[sourceRegion]?.length || 0;
      const previousSourceCount = previousGameState?.soldiersByRegion?.[sourceRegion]?.length || 0;
      // Attacking soldiers = those that left source (some died, some returned)
      attackingSoldierCount = Math.max(0, previousSourceCount - finalSourceCount + totalAttackerCasualties);
      // Or simpler: use the casualties as a lower bound
      if (attackingSoldierCount === 0) {
        attackingSoldierCount = totalAttackerCasualties + 1; // At least the casualties plus survivors
      }
    } else {
      // Fallback: use soldier count from move
      attackingSoldierCount = move.soldierCount || 1;
    }

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

    // Step 3: Animate survivors retreating back to source
    await this.animateSurvivorsRetreat(animationState, finalGameState, sourceRegion, targetRegion);

    // Step 4: Final feedback - highlight the defended region
    this.feedbackPlayer.highlightRegion(targetRegion, 'defended');
    await delay(GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
  }

  /**
   * Animate surviving attackers retreating from their halfway position back to source
   * Clears attackedRegion to trigger CSS transition back to source position
   */
  private async animateSurvivorsRetreat(
    animationState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    if (!animationState || !finalGameState) return;

    // Get survivors (soldiers still at source in final state)
    const survivors = finalGameState.soldiersByRegion?.[sourceRegion] || [];
    const survivorIds = new Set(survivors.map((s: any) => s.i));

    // Build state where survivors return from halfway (clear attackedRegion)
    const retreatState = JSON.parse(JSON.stringify(animationState));
    const sourceSoldiers = retreatState.soldiersByRegion[sourceRegion] || [];

    // Update soldiers: survivors clear attackedRegion (animate back), dead attackers are removed
    retreatState.soldiersByRegion[sourceRegion] = sourceSoldiers
      .filter((s: any) => {
        // Keep soldiers not attacking OR survivors who will retreat
        return !s.attackedRegion || survivorIds.has(s.i);
      })
      .map((s: any) => {
        // Clear attackedRegion for all - survivors animate back, non-attackers stay put
        return { ...s, attackedRegion: undefined, movingToRegion: undefined };
      });

    // Ownership unchanged - defenders keep the region
    // Don't modify ownersByRegion

    this.dispatchBattleStateUpdate(retreatState);

    // Play retreat sound
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

    await waitForNextFrame();
    await delay(GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
  }

  /**
   * Simple retreat feedback without blow-by-blow animation
   */
  private async playSimpleRetreatFeedback(move: DetectedMove): Promise<void> {
    const targetRegion = move.targetRegion !== undefined ? move.targetRegion : 0;

    audioSystem.playSound(SOUNDS.ATTACK);
    await delay(200);
    audioSystem.playSound(SOUNDS.COMBAT);
    await delay(GAME_CONSTANTS.QUICK_ANIMATION_MS);
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE); // Retreat sound

    this.feedbackPlayer.highlightRegion(targetRegion, 'defended');
    await delay(GAME_CONSTANTS.FEEDBACK_HIGHLIGHT_MS);
  }
}
