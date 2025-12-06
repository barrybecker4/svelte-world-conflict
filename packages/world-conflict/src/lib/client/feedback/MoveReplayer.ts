import { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import { MoveDetector } from './MoveDetector';
import type { DetectedMove } from './MoveDetector';
import { FeedbackPlayer } from './FeedbackPlayer';
import { BattleReplayCoordinator } from './BattleReplayCoordinator';
import { animationQueue } from './TaskQueue';
import { dispatchGameEvent, waitForNextFrame } from './utils';
import type { GameStateData, MoveMetadata } from '$lib/game/entities/gameTypes';

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
  async replayMoves(newState: GameStateData, previousState: GameStateData | null): Promise<void> {
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
    newState: GameStateData,
    previousState: GameStateData,
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
    newState: GameStateData,
    previousState: GameStateData,
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
    newState: GameStateData,
    previousState: GameStateData,
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
    newState: GameStateData,
    previousState: GameStateData,
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
   * Attach attack sequence to the first conquest or failed_attack move found
   */
  private attachAttackSequenceToConquest(
    moves: DetectedMove[],
    attackSequence: unknown[],
    regions: unknown[]
  ): void {
    // Try conquest first, then failed_attack
    const battleMove = moves.find(m => m.type === 'conquest') || moves.find(m => m.type === 'failed_attack');
    if (battleMove) {
      battleMove.attackSequence = attackSequence;
      battleMove.regions = regions;
    }
  }

  /**
   * Play moves sequentially, updating animation state between each
   */
  private async playMovesSequentially(
    moves: DetectedMove[],
    regions: unknown[],
    previousState: GameStateData,
    finalState: GameStateData
  ): Promise<void> {
    let currentAnimationState = this.cloneState(previousState);

    for (const move of moves) {
      const stateForThisMove = this.cloneState(currentAnimationState);

      this.attachConquestContext(move, stateForThisMove, finalState, regions);

      await animationQueue.enqueue(0, async () => {
        await this.playMoveWithFeedback(move, regions, stateForThisMove);
      });

      // Update animation state to reflect this move (soldiers + ownership)
      currentAnimationState = this.applyMoveToState(currentAnimationState, move);

      // Dispatch updated state to show region ownership changes immediately
      const players = currentAnimationState.players as unknown[] | undefined;
      console.log('[MoveReplayer] Dispatching ownership update:', {
        targetRegion: move.regionIndex,
        newOwner: move.newOwner,
        ownersByRegion: currentAnimationState.ownersByRegion,
        hasPlayers: !!players,
        playersCount: players?.length
      });
      dispatchGameEvent('battleStateUpdate', { gameState: currentAnimationState });

      // Allow UI to render the ownership change before next move
      await waitForNextFrame();
    }
  }

  /**
   * Attach context needed for conquest and failed_attack animations
   */
  private attachConquestContext(
    move: DetectedMove,
    previousGameState: GameStateData,
    finalGameState: GameStateData,
    regions: unknown[]
  ): void {
    if (move.type === 'conquest' || move.type === 'failed_attack') {
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
    newState: GameStateData,
    previousState: GameStateData
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
    newState: GameStateData,
    previousState: GameStateData
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

    // Check if this was a failed attack (retreat) by looking at the attack sequence
    const attackSequence = moveData.attackSequence as { isRetreat?: boolean }[] | undefined;
    if (attackSequence && attackSequence.some(event => event.isRetreat === true)) {
      return {
        ...baseMove,
        type: 'failed_attack',
        targetRegion: targetRegion,
        oldOwner: previousOwner,
        attackSequence: attackSequence
      };
    }

    return { ...baseMove, type: 'movement' };
  }

  /**
   * Apply a move to the animation state to prepare for the next move's animation
   * This simulates what the move did so subsequent animations start from correct positions
   */
  applyMoveToState(state: GameStateData, move: DetectedMove): GameStateData {
    const newState = this.cloneState(state);

    // For failed_attack, survivors stay at source - no transfer needed
    if (move.type === 'failed_attack') {
      // Note: casualties have already been removed by battle logic
      // Ownership unchanged, soldiers remain at source
      return newState;
    }

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
    state: GameStateData,
    sourceRegion: number,
    targetRegion: number,
    count: number
  ): void {
    const sourceSoldiers = [...(state.soldiersByRegion![sourceRegion] || [])];
    const targetSoldiers = [...(state.soldiersByRegion![targetRegion] || [])];

    // Move soldiers from source to target (server uses pop() from end)
    const soldiersToMove = sourceSoldiers.splice(-count, count);

    // Clear movement flags
    soldiersToMove.forEach(s => {
      s.movingToRegion = undefined;
      s.attackedRegion = undefined;
    });

    targetSoldiers.push(...soldiersToMove);

    // Update the state directly
    state.soldiersByRegion[sourceRegion] = sourceSoldiers;
    state.soldiersByRegion[targetRegion] = targetSoldiers;
  }

  private cloneState(state: GameStateData): GameStateData {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   */
  private async playMoveWithFeedback(
    move: DetectedMove,
    regions: unknown[],
    previousState: GameStateData
  ): Promise<void> {
    switch (move.type) {
      case 'conquest':
        await this.battleCoordinator.playConquest(move, regions);
        break;
      case 'failed_attack':
        await this.battleCoordinator.playFailedAttack(move, regions);
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
