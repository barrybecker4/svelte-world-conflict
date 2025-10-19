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
   * Main entry point: Play sound effects and show visual feedback for other player moves
   * Uses TaskQueue to ensure moves play sequentially without overlap
   * @param newState - The updated game state
   * @param previousState - The previous game state for comparison
   * @returns Promise that resolves when all moves complete
   */
  async replayMoves(newState: any, previousState: any): Promise<void> {
    if (!previousState) {
      console.log('No previous state available for move replay');
      return;
    }

    console.log('Playing other player moves...');

    // Extract attack sequence and regions from new state if available
    const attackSequence = newState.attackSequence;
    const regions = newState.regions || [];

    console.log('🔍 MoveReplayer: Attack sequence check:', {
      hasAttackSequence: !!attackSequence,
      attackSequenceLength: attackSequence?.length || 0,
      regionsCount: regions.length
    });

    // Detect what changed between states to determine move types
    const moves = this.moveDetector.detectMoves(newState, previousState);

    // Attach attack sequence and regions to conquest moves if available
    if (attackSequence && moves.length > 0) {
      const conquestMove = moves.find(m => m.type === 'conquest');
      if (conquestMove) {
        console.log('✅ MoveReplayer: Attaching attack sequence to conquest move', {
          sequenceLength: attackSequence.length,
          regionIndex: conquestMove.regionIndex
        });
        conquestMove.attackSequence = attackSequence;
        (conquestMove as any).regions = regions; // Attach regions for animation
      } else {
        console.log('⚠️ MoveReplayer: Attack sequence present but no conquest move found');
      }
    }

    if (moves.length === 0) {
      console.log('No moves detected to replay');
      return;
    }

    console.log(`Replaying ${moves.length} moves:`, moves);

    // Queue all moves sequentially using TaskQueue
    // Each move's duration is determined by its actual animation time
    for (const move of moves) {
      await animationQueue.enqueue(0, async () => {
        await this.playMoveWithFeedback(move, regions);
      });
    }
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   * @param move - The move to play back
   * @param regions - The regions array for battle animations
   * @returns Promise that resolves when move animation completes
   */
  private async playMoveWithFeedback(move: DetectedMove, regions: any[]): Promise<void> {
    console.log('Playing move:', move);

    switch (move.type) {
      case 'conquest':
        await this.battleCoordinator.playConquest(move, regions);
        break;

      case 'movement':
        await this.feedbackPlayer.playMovement(move);
        break;

      case 'recruitment':
        await this.feedbackPlayer.playRecruitment(move);
        break;

      case 'upgrade':
        await this.feedbackPlayer.playUpgrade(move);
        break;

      default:
        console.log('Unknown move type:', move.type);
    }
  }
}
