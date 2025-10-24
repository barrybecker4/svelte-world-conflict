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
    const previousGameState = (move as any).previousGameState;
    const finalGameState = (move as any).finalGameState;

    // Step 1: Set up halfway positioning for attacking soldiers
    const animationState = await this.prepareAttackAnimation(
      previousGameState,
      sourceRegion,
      targetRegion
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
    targetRegion: number
  ): Promise<any> {
    if (!previousGameState || !previousGameState.soldiersByRegion) {
      return null;
    }

    // Create a deep copy of game state for animation
    const animationState = JSON.parse(JSON.stringify(previousGameState));

    // Set attackedRegion on attacking soldiers (for halfway positioning)
    const attackingSoldiers = animationState.soldiersByRegion[sourceRegion] || [];
    console.log(
      `⚔️ AI Battle: Setting attackedRegion on ${attackingSoldiers.length} soldiers from region ${sourceRegion}`
    );

    attackingSoldiers.forEach((soldier: any) => {
      soldier.attackedRegion = targetRegion;
    });

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

    // Get surviving soldier IDs (these are now at target in finalGameState)
    const survivorIds = new Set(targetSoldiersInFinal.map((s: any) => s.i));

    // Find survivors from the attack in the PREVIOUS animation state
    const currentSourceSoldiers = previousGameState.soldiersByRegion?.[sourceRegion] || [];
    const survivingAttackers = currentSourceSoldiers.filter(
      (s: any) => s.attackedRegion === targetRegion && survivorIds.has(s.i)
    );

    console.log(`Found ${survivingAttackers.length} surviving attackers to animate (out of ${targetSoldiersInFinal.length} at target)`);

    // CRITICAL: Clear target region FIRST to avoid duplicates
    newAnimationState.soldiersByRegion[targetRegion] = [];

    // Then place survivors at source with movingToRegion set
    // This ensures each soldier is in exactly ONE region at a time
    newAnimationState.soldiersByRegion[sourceRegion] = survivingAttackers.map((s: any) => ({
      ...s,
      attackedRegion: undefined,
      movingToRegion: targetRegion
    }));

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
