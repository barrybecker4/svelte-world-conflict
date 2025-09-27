/**
 * Player slot configuration for game setup
 * Used during game creation to configure player positions
 */

export type PlayerSlotType = 'Off' | 'Set' | 'Open' | 'AI';

export interface PlayerSlot {
  slotIndex: number;
  type: PlayerSlotType;
  name?: string;
  defaultName: string;
  customName?: string;

  // Visual styling (from PlayerConfig)
  color: string;
  colorStart: string;
  colorEnd: string;
  highlightStart: string;
  highlightEnd: string;
}

/**
 * Type guard to check if a slot is active (not 'Off')
 */
export function isActivePlayerSlot(slot: PlayerSlot): boolean {
  return slot.type !== 'Off';
}

/**
 * Type guard to check if a slot is human-controlled
 */
export function isHumanPlayerSlot(slot: PlayerSlot): boolean {
  return slot.type === 'Set' || slot.type === 'Open';
}

/**
 * Type guard to check if a slot is AI-controlled
 */
export function isAIPlayerSlot(slot: PlayerSlot): boolean {
  return slot.type === 'AI';
}

/**
 * Get display name for a player slot
 */
export function getPlayerSlotDisplayName(slot: PlayerSlot): string {
  switch (slot.type) {
    case 'Off':
      return slot.defaultName;
    case 'Set':
      return slot.customName || slot.name || slot.defaultName;
    case 'Open':
      return '< open >';
    case 'AI':
      return `${slot.defaultName} (AI)`;
    default:
      return slot.defaultName;
  }
}

/**
 * Convert player slot to simplified player data for game state
 */
export function playerSlotToGamePlayer(slot: PlayerSlot, slotIndex: number) {
  return {
    slotIndex,
    name: getPlayerSlotDisplayName(slot),
    color: slot.colorStart,
    isAI: slot.type === 'AI'
  };
}
