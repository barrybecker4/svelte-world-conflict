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
   * Clear the battlefield before conquest animation
   * Removes dead defenders and positions survivors at source for animation
   */
  private clearBattlefield(
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): void {
    const clearedState = JSON.parse(JSON.stringify(finalGameState));
    const survivors = finalGameState.soldiersByRegion?.[targetRegion] || [];
    
    clearedState.soldiersByRegion[targetRegion] = [];
    
    const soldiersAtSource = finalGameState.soldiersByRegion?.[sourceRegion] || [];
    const allAtSource = [...soldiersAtSource, ...survivors].map((s: any) => ({
      ...s,
      attackedRegion: undefined,
      movingToRegion: undefined
    }));
    
    clearedState.soldiersByRegion[sourceRegion] = allAtSource;
    this.dispatchBattleStateUpdate(clearedState);
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
      const wasSuccessful = this.isConquestSuccessful(finalGameState, sourceRegion, targetRegion);
      
      if (!wasSuccessful) {
        audioSystem.playSound(SOUNDS.REGION_CONQUERED);
        return;
      }
      
      this.clearBattlefield(finalGameState, sourceRegion, targetRegion);
      
      await waitForNextFrame();
      
      await this.animateConqueringMove(animationState, finalGameState, sourceRegion, targetRegion);
    }

    audioSystem.playSound(SOUNDS.REGION_CONQUERED);
  }

  /**
   * Helper to dispatch battle state updates
   */
  private dispatchBattleStateUpdate(gameState: any): void {
    dispatchGameEvent('battleStateUpdate', { gameState });
  }

  /**
   * Animate conquering soldiers moving into the conquered region
   */
  private async animateConqueringMove(
    previousGameState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    const targetSoldiersInFinal = finalGameState.soldiersByRegion?.[targetRegion] || [];

    const newAnimationState = this.buildConquestAnimationState(
      previousGameState,
      finalGameState,
      sourceRegion,
      targetRegion,
      targetSoldiersInFinal
    );

    this.dispatchBattleStateUpdate(newAnimationState);

    await waitForNextFrame();
    await delay(GAME_CONSTANTS.SOLDIER_MOVE_ANIMATION_MS);
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
   * Build animation state for conquest movement
   */
  private buildConquestAnimationState(
    previousGameState: any,
    finalGameState: any,
    sourceRegion: number,
    targetRegion: number,
    targetSoldiersInFinal: any[]
  ): any {
    const newAnimationState = JSON.parse(JSON.stringify(finalGameState));
    const survivors = targetSoldiersInFinal;

    newAnimationState.soldiersByRegion[targetRegion] = [];

    const soldiersAtSource = finalGameState.soldiersByRegion?.[sourceRegion] || [];
    const survivorIds = new Set(survivors.map((s: any) => s.i));
    
    const updatedSourceSoldiers = [...soldiersAtSource, ...survivors].map((s: any) => ({
      ...s,
      movingToRegion: survivorIds.has(s.i) ? targetRegion : undefined,
      attackedRegion: undefined
    }));
    
    newAnimationState.soldiersByRegion[sourceRegion] = updatedSourceSoldiers;
    newAnimationState.ownersByRegion = {
      ...newAnimationState.ownersByRegion,
      [targetRegion]: finalGameState.ownersByRegion[targetRegion]
    };

    return newAnimationState;
  }

  /**
   * Simple conquest feedback without blow-by-blow animation
   */
  private async playSimpleConquestFeedback(move: DetectedMove): Promise<void> {
    if (move.sourceRegion !== undefined) {
      const movementMove = {
        type: 'movement' as const,
        regionIndex: move.regionIndex,
        oldCount: move.oldCount || 0,
        newCount: move.newCount || 1,
        soldierCount: (move.newCount || 1) - (move.oldCount || 0),
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
}
