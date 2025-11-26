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
    const regions = newState.regions || [];

    // Prefer server-provided move metadata over client-side detection
    let moves: DetectedMove[] = [];
    
    if (lastMove && lastMove.type !== 'end_turn') {
      moves = [this.constructMoveFromMetadata(lastMove, newState, previousState)];
    } else {
      moves = this.moveDetector.detectMoves(newState, previousState);
    }

    // Attach attack sequence and context to conquest moves
    if (attackSequence && moves.length > 0) {
      const conquestMove = moves.find(m => m.type === 'conquest');
      if (conquestMove) {
        conquestMove.attackSequence = attackSequence;
        conquestMove.regions = regions;
        conquestMove.previousGameState = previousState;
        conquestMove.finalGameState = newState;
      }
    }

    // Attach context to all conquest moves
    moves.forEach(move => {
      if (move.type === 'conquest') {
        move.previousGameState = previousState;
        move.finalGameState = newState;
        move.regions = regions;
      }
    });

    if (moves.length === 0) return;

    // Queue moves sequentially
    for (const move of moves) {
      await animationQueue.enqueue(0, async () => {
        await this.playMoveWithFeedback(move, regions, previousState);
      });
    }
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
