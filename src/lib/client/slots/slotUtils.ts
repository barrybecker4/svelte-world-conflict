/**
 * Shared utilities for game slot management
 * Used by both Lobby and WaitingRoom components
 */

export interface BaseSlotInfo {
  type: 'open' | 'creator' | 'taken' | 'ai' | 'disabled';
  name: string;
  canJoin?: boolean;
  color?: string;
  isCurrentPlayer?: boolean;
}

/**
 * Determines if a slot is joinable in the lobby context
 */
export function isSlotJoinable(slotInfo: BaseSlotInfo): boolean {
  return slotInfo.type === 'open' && slotInfo.canJoin === true;
}

/**
 * Gets the appropriate button variant for a slot
 */
export function getSlotButtonVariant(slotInfo: BaseSlotInfo): string {
  switch (slotInfo.type) {
    case 'open': return 'success';
    case 'creator': return 'primary';
    case 'taken': return 'secondary';
    case 'ai': return 'ghost';
    case 'disabled': return 'ghost';
    default: return 'secondary';
  }
}

/**
 * Formats time ago from timestamp
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

/**
 * Gets default player name for a slot
 */
export function getDefaultPlayerName(slotIndex: number): string {
  const defaultNames = ['Crimson', 'Azure', 'Emerald', 'Golden'];
  return defaultNames[slotIndex] || `Player${slotIndex + 1}`;
}

/**
 * Counts open slots in a game
 */
export function countOpenSlots(game: any): number {
  if (!game?.pendingConfiguration?.playerSlots) return 0;

  return game.pendingConfiguration.playerSlots.filter((slot, slotIndex) => {
    if (!slot || slot.type !== 'Open') return false;
    return !game.players?.some(p => p.slotIndex === slotIndex);
  }).length;
}

/**
 * Counts active players in a game
 */
export function countActivePlayers(game: any): number {
  return game?.players?.length || 0;
}

/**
 * Counts total active slots (non-Off slots)
 */
export function countTotalActiveSlots(game: any): number {
  return game?.pendingConfiguration?.playerSlots?.filter(s => s && s.type !== 'Off').length || 4;
}
