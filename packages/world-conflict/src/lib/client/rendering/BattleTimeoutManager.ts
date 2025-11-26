import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from '$lib/client/utils/logger';

/**
 * Manages battle timeouts to prevent stuck battles
 */
export class BattleTimeoutManager {
  private battleTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
  private defaultTimeoutMs = GAME_CONSTANTS.BATTLE_TIMEOUT_MS;

  /**
   * Start battle timeout for a specific region
   */
  startBattleTimeout(regionIndex: number, timeoutMs?: number): void {
    const timeoutId = setTimeout(() => {
      logger.warn('BattleTimeoutManager: Battle timeout reached for region', regionIndex);
      this.clearBattleTimeout(regionIndex);
    }, timeoutMs ?? this.defaultTimeoutMs);

    this.battleTimeouts.set(regionIndex, timeoutId);
  }

  /**
   * Clear battle timeout for a specific region
   */
  clearBattleTimeout(regionIndex: number): void {
    const timeoutId = this.battleTimeouts.get(regionIndex);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.battleTimeouts.delete(regionIndex);
    }
  }

  /**
   * Clear all battle timeouts
   */
  clearAll(): void {
    this.battleTimeouts.forEach(timeout => clearTimeout(timeout));
    this.battleTimeouts.clear();
  }
}