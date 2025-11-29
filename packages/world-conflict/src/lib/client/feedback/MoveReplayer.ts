import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import { MoveDetector } from './MoveDetector';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { BattleReplayCoordinator } from './BattleReplayCoordinator';
import { animationQueue } from './TaskQueue';

/** Server-provided move metadata */
interface MoveMetadata {
  type: 'army_move' | 'recruit' | 'upgrade' | 'end_turn';
  sourceRegion?: number;
  targetRegion?: number;
  soldierCount?: number;
  attackSequence?: unknown[];
}

/** Game state with optional replay data */
interface GameStateWithReplayData {
  attackSequence?: unknown[];
  lastMove?: MoveMetadata;
  turnMoves?: MoveMetadata[];
  regions?: unknown[];
  ownersByRegion?: Record<number, number>;
  soldiersByRegion?: Record<number, unknown[]>;
  [key: string]: unknown;
}

/**
 * Orchestrates replay of other players' moves with audio and visual feedback
 *
 * Coordinates three specialized components:
 * - MoveDetector: Detects what changed between game states (fallback)
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
   */
  async replayMoves(newState: GameStateWithReplayData, previousState: GameStateWithReplayData | null): Promise<void> {
    if (!previousState) return;

    const regions = (newState.regions || []) as unknown[];
    const moves = this.extractMoves(newState, previousState, regions);

    if (moves.length === 0) return;

    await this.playMovesSequentially(moves, regions, previousState, newState);
  }

  /**
   * Extract moves from game state update
   * Prefers server-provided metadata over client-side detection
   */
  private extractMoves(
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData,
    regions: unknown[]
  ): DetectedMove[] {
    const { turnMoves, lastMove, attackSequence } = newState;

    // Priority 1: Use turnMoves array (multiple moves from end-turn)
    if (turnMoves && turnMoves.length > 0) {
      return this.extractFromTurnMoves(turnMoves, newState, previousState, regions);
    }

    // Priority 2: Use single lastMove metadata
    if (lastMove && lastMove.type !== 'end_turn') {
      return this.extractFromLastMove(lastMove, newState, previousState, attackSequence, regions);
    }

    // Priority 3: Fallback to state-diff detection
    return this.extractFromStateDiff(newState, previousState, attackSequence, regions);
  }

  /**
   * Extract moves from server-provided turnMoves array
   */
  private extractFromTurnMoves(
    turnMoves: MoveMetadata[],
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData,
    regions: unknown[]
  ): DetectedMove[] {
    const moves = turnMoves.map(move =>
      this.constructMoveFromMetadata(move, newState, previousState)
    );

    // Attach attack sequences from individual moves
    turnMoves.forEach((turnMove, index) => {
      if (turnMove.attackSequence && moves[index]) {
        moves[index].attackSequence = turnMove.attackSequence;
        moves[index].regions = regions;
      }
    });

    return moves;
  }

  /**
   * Extract move from single lastMove metadata
   */
  private extractFromLastMove(
    lastMove: MoveMetadata,
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData,
    attackSequence: unknown[] | undefined,
    regions: unknown[]
  ): DetectedMove[] {
    const moves = [this.constructMoveFromMetadata(lastMove, newState, previousState)];

    if (attackSequence) {
      this.attachAttackSequenceToConquest(moves, attackSequence, regions);
    }

    return moves;
  }

  /**
   * Extract moves by detecting state differences (legacy fallback)
   */
  private extractFromStateDiff(
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData,
    attackSequence: unknown[] | undefined,
    regions: unknown[]
  ): DetectedMove[] {
    const moves = this.moveDetector.detectMoves(newState, previousState);

    if (attackSequence && moves.length > 0) {
      this.attachAttackSequenceToConquest(moves, attackSequence, regions);
    }

    return moves;
  }

  /**
   * Attach attack sequence to the first conquest move found
   */
  private attachAttackSequenceToConquest(
    moves: DetectedMove[],
    attackSequence: unknown[],
    regions: unknown[]
  ): void {
    const conquestMove = moves.find(m => m.type === 'conquest');
    if (conquestMove) {
      conquestMove.attackSequence = attackSequence;
      conquestMove.regions = regions;
    }
  }

  /**
   * Play moves sequentially, updating animation state between each
   */
  private async playMovesSequentially(
    moves: DetectedMove[],
    regions: unknown[],
    previousState: GameStateWithReplayData,
    finalState: GameStateWithReplayData
  ): Promise<void> {
    let currentAnimationState = this.cloneState(previousState);

    for (const move of moves) {
      const stateForThisMove = this.cloneState(currentAnimationState);

      this.attachConquestContext(move, stateForThisMove, finalState, regions);

      await animationQueue.enqueue(0, async () => {
        await this.playMoveWithFeedback(move, regions, stateForThisMove);
      });

      currentAnimationState = this.applyMoveToState(currentAnimationState, move);
    }
  }

  /**
   * Attach context needed for conquest animations
   */
  private attachConquestContext(
    move: DetectedMove,
    previousGameState: GameStateWithReplayData,
    finalGameState: GameStateWithReplayData,
    regions: unknown[]
  ): void {
    if (move.type === 'conquest') {
      move.previousGameState = previousGameState;
      move.finalGameState = finalGameState;
      move.regions = regions;
    }
  }

  /**
   * Construct a DetectedMove from server-provided move metadata
   */
  constructMoveFromMetadata(
    moveData: MoveMetadata,
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData
  ): DetectedMove {
    switch (moveData.type) {
      case 'army_move':
        return this.constructArmyMove(moveData, newState, previousState);
      case 'recruit':
        return { type: 'recruitment', regionIndex: moveData.targetRegion! };
      case 'upgrade':
        return { type: 'upgrade', regionIndex: moveData.targetRegion! };
      default:
        throw new Error(`Unknown move type: ${moveData.type}`);
    }
  }

  /**
   * Construct army move or conquest from metadata
   */
  private constructArmyMove(
    moveData: MoveMetadata,
    newState: GameStateWithReplayData,
    previousState: GameStateWithReplayData
  ): DetectedMove {
    const targetRegion = moveData.targetRegion!;
    const previousOwner = previousState.ownersByRegion?.[targetRegion];
    const newOwner = newState.ownersByRegion?.[targetRegion];
    const wasConquest = previousOwner !== newOwner;

    const baseMove = {
      regionIndex: targetRegion,
      sourceRegion: moveData.sourceRegion,
      soldierCount: moveData.soldierCount || 0
    };

    if (wasConquest) {
      return {
        ...baseMove,
        type: 'conquest',
        oldOwner: previousOwner,
        newOwner: newOwner
      };
    }

    return { ...baseMove, type: 'movement' };
  }

  /**
   * Apply a move to the animation state to prepare for the next move's animation
   * This simulates what the move did so subsequent animations start from correct positions
   */
  applyMoveToState(state: GameStateWithReplayData, move: DetectedMove): GameStateWithReplayData {
    const newState = this.cloneState(state);

    if (move.type !== 'movement' && move.type !== 'conquest') {
      return newState;
    }

    const { sourceRegion, regionIndex: targetRegion, soldierCount = 0 } = move;

    if (sourceRegion !== undefined && newState.soldiersByRegion) {
      this.transferSoldiers(newState, sourceRegion, targetRegion, soldierCount);
    }

    if (move.type === 'conquest' && move.newOwner !== undefined) {
      newState.ownersByRegion = { ...newState.ownersByRegion, [targetRegion]: move.newOwner };
    }

    return newState;
  }

  /**
   * Transfer soldiers between regions in the animation state
   */
  private transferSoldiers(
    state: GameStateWithReplayData,
    sourceRegion: number,
    targetRegion: number,
    count: number
  ): void {
    const sourceSoldiers = [...(state.soldiersByRegion![sourceRegion] || [])] as Record<string, unknown>[];
    const targetSoldiers = [...(state.soldiersByRegion![targetRegion] || [])] as Record<string, unknown>[];

    // Move soldiers from source to target (server uses pop() from end)
    const soldiersToMove = sourceSoldiers.splice(-count, count);

    // Clear movement flags
    soldiersToMove.forEach(s => {
      s.movingToRegion = undefined;
      s.attackedRegion = undefined;
    });

    targetSoldiers.push(...soldiersToMove);

    state.soldiersByRegion = {
      ...state.soldiersByRegion,
      [sourceRegion]: sourceSoldiers,
      [targetRegion]: targetSoldiers
    };
  }

  private cloneState(state: GameStateWithReplayData): GameStateWithReplayData {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   */
  private async playMoveWithFeedback(
    move: DetectedMove,
    regions: unknown[],
    previousState: GameStateWithReplayData
  ): Promise<void> {
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
