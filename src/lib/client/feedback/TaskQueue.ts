/**
 * Task to be executed in the queue
 */
export interface Task {
  duration: number; // Duration in milliseconds
  fn: () => void | Promise<void>; // Function to execute (can be sync or async)
}

/**
 * Provides sequential execution of animations and tasks to ensure
 * that they run one after another rather than overlapping.
 * 
 * This is particularly important for maintaining visual clarity
 * during game animations and state transitions.
 * 
 * Based on the oneAtATime pattern from the old GAS version.
 */
export class TaskQueue {
  private queue: Task[] = [];
  private isProcessing = false;

  /**
   * Add a task to the queue and execute it when ready.
   * Returns a promise that resolves when the task completes.
   * 
   * @param duration - How long the task takes in milliseconds
   * @param fn - The function to execute (can be sync or async)
   * @returns Promise that resolves when task completes
   */
  async enqueue(duration: number, fn: () => void | Promise<void>): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({
        duration,
        fn: async () => {
          await fn();
          resolve();
        }
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  }

  /**
   * Process the next task in the queue
   */
  private async processNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      // Execute the task function (may be async)
      await task.fn();

      // Wait for the specified duration
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), task.duration);
      });
    } catch (error) {
      console.error('Task execution failed:', error);
    }

    // Process next task
    this.processNext();
  }

  /**
   * Clear all pending tasks (useful for cleanup on unmount)
   */
  clear(): void {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Get the number of tasks currently in the queue
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently processing a task
   */
  get isActive(): boolean {
    return this.isProcessing;
  }
}

/**
 * Global task queue instance for animation sequencing
 * This ensures all animations across the app are properly sequenced
 */
export const animationQueue = new TaskQueue();


