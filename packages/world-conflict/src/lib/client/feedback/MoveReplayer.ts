import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import { MoveDetector } from './MoveDetector';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { BattleReplayCoordinator } from './BattleReplayCoordinator';
import { animationQueue } from './TaskQueue';

/**
 * Orchestrates replay of other players' moves with audio and visual feedback
 * Simplified to coordinate three specialized components:
 * - MoveDetector: Detects what changed between game states
 * - FeedbackPlayer: Plays simple audio/visual feedback
 * - BattleReplayCoordinator: Handles complex battle animations
 *
 * Uses TaskQueue for guaranteed sequential execution of animations
 */
export class MoveReplayer {
  private moveDetector: MoveDetector;
  private feedbackPlayer: FeedbackPlayer;
  private battleCoordinator: BattleReplayCoordinator;

  constructor() {
    this.moveDetector = new MoveDetector();
    this.feedbackPlayer = new FeedbackPlayer();
    this.battleCoordinator = new BattleReplayCoordinator(this.feedbackPlayer);
  }

  /**
   * Set the battle animation system for playing battle sequences
   */
  setBattleAnimationSystem(system: BattleAnimationSystem): void {
    this.battleCoordinator.setBattleAnimationSystem(system);
  }

  /**
   * Construct a DetectedMove from server-provided move metadata
   */
  private constructMoveFromMetadata(
    lastMove: { type: 'army_move' | 'recruit' | 'upgrade' | 'end_turn', sourceRegion?: number, targetRegion?: number, soldierCount?: number },
    newState: any,
    previousState: any
  ): DetectedMove {
    if (lastMove.type === 'army_move') {
      const targetRegion = lastMove.targetRegion!;
      const previousOwner = previousState.ownersByRegion?.[targetRegion];
      const newOwner = newState.ownersByRegion?.[targetRegion];
      const wasConquest = previousOwner !== newOwner;

      if (wasConquest) {
        return {
          type: 'conquest',
          regionIndex: targetRegion,
          sourceRegion: lastMove.sourceRegion,
          soldierCount: lastMove.soldierCount || 0, // Include soldier count for conquests too!
          oldOwner: previousOwner,
          newOwner: newOwner
        };
      } else {
        return {
          type: 'movement',
          regionIndex: targetRegion,
          sourceRegion: lastMove.sourceRegion,
          soldierCount: lastMove.soldierCount || 0
        };
      }
    } else if (lastMove.type === 'recruit') {
      return {
        type: 'recruitment',
        regionIndex: lastMove.targetRegion!
      };
    } else if (lastMove.type === 'upgrade') {
      return {
        type: 'upgrade',
        regionIndex: lastMove.targetRegion!
      };
    }

    throw new Error(`Unknown move type: ${lastMove.type}`);
  }

  /**
   * Main entry point: Play sound effects and show visual feedback for other player moves
   * Uses TaskQueue to ensure moves play sequentially without overlap
   * @param newState - The updated game state
   * @param previousState - The previous game state for comparison
   * @returns Promise that resolves when all moves complete
   */
  async replayMoves(newState: any, previousState: any): Promise<void> {
    if (!previousState) return;

    const attackSequence = newState.attackSequence;
    const lastMove = newState.lastMove;
    const turnMoves = newState.turnMoves;
    const regions = newState.regions || [];

    // Prefer server-provided move metadata over client-side detection
    let moves: DetectedMove[] = [];

    if (turnMoves && turnMoves.length > 0) {
      // Use the array of moves from server for accurate sequential replay
      moves = turnMoves.map((move: any, index: number) => {
        const constructed = this.constructMoveFromMetadata(move, newState, previousState);
        console.log(`[MoveReplayer] Constructed move ${index}:`, {
          original: move,
          constructed: constructed
        });
        return constructed;
      });

      // Attach attack sequences from individual moves
      turnMoves.forEach((turnMove: any, index: number) => {
        if (turnMove.attackSequence && moves[index]) {
          moves[index].attackSequence = turnMove.attackSequence;
          moves[index].regions = regions;
        }
      });
    } else if (lastMove && lastMove.type !== 'end_turn') {
      moves = [this.constructMoveFromMetadata(lastMove, newState, previousState)];

      // Attach attack sequence for single move
      if (attackSequence && moves.length > 0) {
        const conquestMove = moves.find(m => m.type === 'conquest');
        if (conquestMove) {
          conquestMove.attackSequence = attackSequence;
          conquestMove.regions = regions;
        }
      }
    } else {
      console.log('[MoveReplayer] FALLBACK: Using MoveDetector (no turnMoves or lastMove)');
      moves = this.moveDetector.detectMoves(newState, previousState);
      console.log('[MoveReplayer] MoveDetector detected:', moves);

      // Attach attack sequence for detected moves (legacy fallback)
      if (attackSequence && moves.length > 0) {
        const conquestMove = moves.find(m => m.type === 'conquest');
        if (conquestMove) {
          conquestMove.attackSequence = attackSequence;
          conquestMove.regions = regions;
        }
      }
    }

    if (moves.length === 0) return;

    // Track animation state as we replay moves sequentially
    // Each move updates this state so the next move animates from the correct position
    let currentAnimationState = JSON.parse(JSON.stringify(previousState));

    // Queue moves sequentially, updating state after each
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      // Capture current state for this move's animation
      const stateForThisMove = JSON.parse(JSON.stringify(currentAnimationState));

      console.log(`[MoveReplayer] Playing move ${i}:`, {
        type: move.type,
        sourceRegion: move.sourceRegion,
        targetRegion: move.regionIndex,
        soldierCount: move.soldierCount,
        soldiersAtSource: stateForThisMove.soldiersByRegion?.[move.sourceRegion!]?.length,
        soldiersAtTarget: stateForThisMove.soldiersByRegion?.[move.regionIndex]?.length
      });

      // Attach context to conquest moves
      if (move.type === 'conquest') {
        move.previousGameState = stateForThisMove;
        move.finalGameState = newState;
        move.regions = regions;
      }

      await animationQueue.enqueue(0, async () => {
        await this.playMoveWithFeedback(move, regions, stateForThisMove);
      });

      // Update animation state to reflect this move for next iteration
      currentAnimationState = this.applyMoveToState(currentAnimationState, move);

      console.log(`[MoveReplayer] After applying move ${i}:`, {
        soldiersAtSource: currentAnimationState.soldiersByRegion?.[move.sourceRegion!]?.length,
        soldiersAtTarget: currentAnimationState.soldiersByRegion?.[move.regionIndex]?.length
      });
    }
  }

  /**
   * Apply a move to the animation state to prepare for the next move's animation
   * This simulates what the move did so subsequent animations start from correct positions
   */
  private applyMoveToState(state: any, move: DetectedMove): any {
    const newState = JSON.parse(JSON.stringify(state));

    if (move.type === 'movement' || move.type === 'conquest') {
      const sourceRegion = move.sourceRegion;
      const targetRegion = move.regionIndex;
      const soldierCount = move.soldierCount || 0;

      if (sourceRegion !== undefined && newState.soldiersByRegion) {
        const sourceSoldiers = newState.soldiersByRegion[sourceRegion] || [];
        const targetSoldiers = newState.soldiersByRegion[targetRegion] || [];

        // Move soldiers from source to target (server uses pop() from end)
        const soldiersToMove = sourceSoldiers.splice(-soldierCount, soldierCount);

        // Clear movement flags before adding to target
        soldiersToMove.forEach((s: any) => {
          s.movingToRegion = undefined;
          s.attackedRegion = undefined;
        });

        targetSoldiers.push(...soldiersToMove);
        newState.soldiersByRegion[targetRegion] = targetSoldiers;
      }

      // Update ownership for conquests
      if (move.type === 'conquest' && move.newOwner !== undefined) {
        newState.ownersByRegion[targetRegion] = move.newOwner;
      }
    }

    return newState;
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   */
  private async playMoveWithFeedback(move: DetectedMove, regions: any[], previousState: any): Promise<void> {
    switch (move.type) {
      case 'conquest':
        await this.battleCoordinator.playConquest(move, regions);
        break;
      case 'movement':
        await this.feedbackPlayer.playMovement(move, previousState);
        break;
      case 'recruitment':
        await this.feedbackPlayer.playRecruitment(move);
        break;
      case 'upgrade':
        await this.feedbackPlayer.playUpgrade(move);
        break;
    }
  }
}
