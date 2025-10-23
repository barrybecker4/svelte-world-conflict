import type { GameStateData } from '$lib/game/entities/gameTypes';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { cloneGameState } from '$lib/game/utils/GameStateUtils';

/**
 * Coordinates animation states for battles and peaceful moves
 * Handles creation of animation states, event dispatching, and multi-phase animations
 */
export class AnimationStateCoordinator {
  /**
   * Create animation state for attacking soldiers (marks soldiers with attackedRegion)
   */
  createAttackingAnimationState(
    gameState: GameStateData,
    sourceRegion: number,
    targetRegion: number,
    soldierCount: number
  ): GameStateData {
    console.log(`⚔️ Creating attacking animation state: ${soldierCount} soldiers from ${sourceRegion} to ${targetRegion}`);

    // Create a deep copy of the game state for animation
    const animationState = cloneGameState(gameState);
    const animationSoldiers = animationState.soldiersByRegion?.[sourceRegion] || [];

    // Set attackedRegion on the animation state's soldiers (for halfway animation)
    animationSoldiers.slice(0, soldierCount).forEach((soldier: any) => {
      soldier.attackedRegion = targetRegion;
    });

    return animationState;
  }

  /**
   * Create animation state for peaceful move (marks soldiers with movingToRegion)
   */
  createPeacefulMoveAnimationState(
    gameState: GameStateData,
    sourceRegion: number,
    targetRegion: number,
    soldierCount: number
  ): GameStateData {
    console.log(`🕊️ Creating peaceful move animation state: ${soldierCount} soldiers from ${sourceRegion} to ${targetRegion}`);

    // Create animation state: Mark soldiers with movingToRegion but keep them at source
    const animationState = cloneGameState(gameState);
    const sourceSoldiers = animationState.soldiersByRegion?.[sourceRegion] || [];

    console.log(`📍 Source region ${sourceRegion} has ${sourceSoldiers.length} soldiers:`, sourceSoldiers.map((s: any) => s.i));
    console.log(`🎯 Marking LAST ${soldierCount} soldiers as moving to ${targetRegion} (server uses pop())`);

    // Mark soldiers as moving (they stay in source array for rendering)
    // IMPORTANT: Server uses pop() which takes from END of array, so mark the LAST N soldiers
    const startIndex = Math.max(0, sourceSoldiers.length - soldierCount);
    for (let i = startIndex; i < sourceSoldiers.length; i++) {
      console.log(`  ✅ Soldier ${sourceSoldiers[i].i} at index ${i} marked as moving to ${targetRegion}`);
      sourceSoldiers[i].movingToRegion = targetRegion;
    }

    console.log(`📍 Remaining ${startIndex} soldiers staying at source:`,
      sourceSoldiers.slice(0, startIndex).map((s: any) => s.i));

    return animationState;
  }

  /**
   * Dispatch battle state update event
   */
  dispatchBattleStateUpdate(animationState: GameStateData): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('battleStateUpdate', {
        detail: { gameState: animationState }
      }));
    }
  }

  /**
   * Animate conquering soldiers moving into the conquered region
   */
  async animateConqueringMove(
    currentAnimationState: GameStateData,
    finalGameState: GameStateData,
    sourceRegion: number,
    targetRegion: number
  ): Promise<void> {
    // Check if conquest was successful by seeing if there are attackers at target
    // AND that the target ownership changed to the attacker's team
    const targetSoldiersInFinal = finalGameState.soldiersByRegion?.[targetRegion] || [];
    const sourceOwner = finalGameState.ownersByRegion?.[sourceRegion];
    const targetOwner = finalGameState.ownersByRegion?.[targetRegion];

    // Only animate if:
    // 1. There are soldiers at the target (attackers survived)
    // 2. Target is now owned by the same player as source (conquest successful)
    const conquestSuccessful = targetSoldiersInFinal.length > 0 && sourceOwner === targetOwner;

    if (!conquestSuccessful) {
      console.log('⚔️ Attack failed or no survivors, skipping conquest animation');
      return; // Attack failed or no survivors
    }

    console.log(`🏆 Conquest successful! Animating ${targetSoldiersInFinal.length} soldiers into region ${targetRegion}`);

    // Create new animation state with survivors still at source
    const newAnimationState = cloneGameState(finalGameState);

    // Get the soldier IDs that survived (now at target in final state)
    const survivorIds = new Set(targetSoldiersInFinal.map((s: any) => s.i));

    // Get soldiers currently at source with attackedRegion
    const currentSourceSoldiers = currentAnimationState.soldiersByRegion?.[sourceRegion] || [];

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

    // Dispatch animation state update
    this.dispatchBattleStateUpdate(newAnimationState);

    // Wait for CSS transition to complete (soldiers moving from halfway to target)
    await new Promise(resolve => setTimeout(resolve, 700));
    console.log('✅ Conquering soldiers reached target region');
  }

  /**
   * Play movement sound
   */
  playMoveSound(): void {
    audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);
  }
}
