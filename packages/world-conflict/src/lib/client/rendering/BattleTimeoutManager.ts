import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Manages battle timeouts to prevent stuck battles
 */
export class BattleTimeoutManager {
  private battleTimeouts = new Map<number, number>();
  private defaultTimeoutMs = GAME_CONSTANTS.BATTLE_TIMEOUT_MS;

  /**
   * Start battle timeout for a specific region
   */
  startBattleTimeout(regionIndex: number, timeoutMs?: number): void {
    console.log('⏰ BattleTimeoutManager: Starting battle timeout for region', regionIndex);

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ BattleTimeoutManager: Battle timeout reached for region', regionIndex);
      this.clearBattleTimeout(regionIndex);
    }, timeoutMs ?? this.defaultTimeoutMs);

    this.battleTimeouts.set(regionIndex, timeoutId as unknown as number);
  }

  /**
   * Clear battle timeout for a specific region
   */
  clearBattleTimeout(regionIndex: number): void {
    const timeoutId = this.battleTimeouts.get(regionIndex);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.battleTimeouts.delete(regionIndex);
      console.log('🔄 BattleTimeoutManager: Cleared battle timeout for region', regionIndex);
    }
  }

  /**
   * Clear all battle timeouts
   */
  clearAll(): void {
    console.log('🧹 BattleTimeoutManager: Clearing all battle timeouts');
    this.battleTimeouts.forEach(timeout => clearTimeout(timeout));
    this.battleTimeouts.clear();
  }
}