import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import { MoveDetector } from './MoveDetector';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { BattleReplayCoordinator } from './BattleReplayCoordinator';

/**
 * Orchestrates replay of other players' moves with audio and visual feedback
 * Simplified to coordinate three specialized components:
 * - MoveDetector: Detects what changed between game states
 * - FeedbackPlayer: Plays simple audio/visual feedback
 * - BattleReplayCoordinator: Handles complex battle animations
 */
export class MoveReplayer {
  private readonly MOVE_PLAYBACK_DELAY = 600; // ms between each move sound/effect
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
   * @param newState - The updated game state
   * @param previousState - The previous game state for comparison
   */
  replayMoves(newState: any, previousState: any): void {
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

    // Play moves with delays
    moves.forEach((move, index) => {
      setTimeout(() => {
        this.playMoveWithFeedback(move, regions);
      }, index * this.MOVE_PLAYBACK_DELAY);
    });
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   * @param move - The move to play back
   * @param regions - The regions array for battle animations
   */
  private playMoveWithFeedback(move: DetectedMove, regions: any[]): void {
    console.log('Playing move:', move);

    switch (move.type) {
      case 'conquest':
        this.battleCoordinator.playConquest(move, regions);
        break;

      case 'movement':
        this.feedbackPlayer.playMovement(move);
        break;

      case 'recruitment':
        this.feedbackPlayer.playRecruitment(move);
        break;

      case 'upgrade':
        this.feedbackPlayer.playUpgrade(move);
        break;

      default:
        console.log('Unknown move type:', move.type);
    }
  }

  /**
   * Update playback delay (useful for different game speeds or testing)
   * @param delayMs - Delay in milliseconds between moves
   */
  setPlaybackDelay(delayMs: number): void {
    if (delayMs > 0) {
      (this as any).MOVE_PLAYBACK_DELAY = delayMs;
    }
  }

  /**
   * Get current playback delay
   */
  getPlaybackDelay(): number {
    return this.MOVE_PLAYBACK_DELAY;
  }
}
