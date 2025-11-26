/**
 * Utility functions for feedback animations
 * Extracted common patterns to reduce duplication
 */

/**
 * Wait for a specified duration
 * @param ms - Duration in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for the next animation frame (double RAF for reliable timing)
 * Uses double requestAnimationFrame to ensure the browser has completed
 * all pending layout and paint operations
 */
export function waitForNextFrame(): Promise<void> {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/**
 * Dispatch a custom game event on the window
 * @param name - Event name
 * @param detail - Event detail payload
 */
export function dispatchGameEvent(name: string, detail: object): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

