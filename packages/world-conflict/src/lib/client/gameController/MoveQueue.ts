/**
 * Queues moves locally during a player's turn
 * Moves are only sent to the server when the turn ends
 * Similar to the old GAS implementation's localHumanMoves array
 */

export interface QueuedMove {
  type: 'ARMY_MOVE' | 'BUILD';
  source?: number;
  destination?: number;
  count?: number;
  regionIndex?: number;
  upgradeIndex?: number;
}

export class MoveQueue {
  private queue: QueuedMove[] = [];

  /**
   * Add a move to the queue
   */
  push(move: QueuedMove): void {
    this.queue.push(move);
    console.log(`📝 Queued move (${this.queue.length} total):`, move);
  }

  /**
   * Remove the last move from the queue (for undo)
   */
  pop(): QueuedMove | undefined {
    const move = this.queue.pop();
    if (move) {
      console.log(`↩️ Removed move from queue (${this.queue.length} remaining):`, move);
    }
    return move;
  }

  /**
   * Get all queued moves
   */
  getAll(): QueuedMove[] {
    return [...this.queue];
  }

  /**
   * Clear all queued moves
   */
  clear(): void {
    console.log(`🧹 Cleared ${this.queue.length} queued moves`);
    this.queue = [];
  }

  /**
   * Check if there are any queued moves
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get the number of queued moves
   */
  size(): number {
    return this.queue.length;
  }
}

