export interface PlayerColorConfig {
  slotIndex: number;
  defaultName: string;
  colorStart: string;
  colorEnd: string;
  highlightStart: string;
  highlightEnd: string;
}

export const PLAYER_CONFIGS: PlayerColorConfig[] = [
  {
    slotIndex: 0,
    defaultName: 'Amber',
    colorStart: '#ffcc46',  // Muted dark goldenrod (was #e6bf2d)
    colorEnd: '#daab1a',    // Darker muted gold (was #daab1a)
    highlightStart: '#daa520',
    highlightEnd: '#b8860b',
  },
  {
    slotIndex: 1,
    defaultName: 'Crimson',
    colorStart: '#bf4f42', // Muted red (was #dc2626)
    colorEnd: '#7a2727',   // Darker muted red (was #991b1b)
    highlightStart: '#cd5c5c',
    highlightEnd: '#a83232',
  },
  {
    slotIndex: 2,
    defaultName: 'Lavender',
    colorStart: '#8b61ba', // Muted purple (was #9A3BF2)
    colorEnd: '#5d4e75',   // Darker muted purple (was #7B68EE)
    highlightStart: '#9370db',
    highlightEnd: '#7b68aa',
  },
  {
    slotIndex: 3,
    defaultName: 'Emerald',
    colorStart: '#2e8b57', // Muted sea green (was #059669)
    colorEnd: '#1e5631',   // Darker muted green (was #047857)
    highlightStart: '#3cb371',
    highlightEnd: '#2e8b57',
  }
];

// Helper functions
export function getPlayerConfig(playerSlotIndex: number): PlayerColorConfig {
  return PLAYER_CONFIGS[playerSlotIndex % PLAYER_CONFIGS.length];
}

export function getPlayerColor(playerSlotIndex: number): string {
  return getPlayerConfig(playerSlotIndex).colorStart;
}

export function getPlayerMapColor(playerSlotIndex: number): string {
  return getPlayerConfig(playerSlotIndex).colorStart;
}

export function getPlayerHighlightColor(playerSlotIndex: number): string {
  return getPlayerConfig(playerSlotIndex).highlightStart;
}

export function getPlayerEndColor(playerSlotIndex: number): string {
  return getPlayerConfig(playerSlotIndex).colorEnd;
}

// For creating Player objects with consistent colors
export function createPlayerWithColors(name: string, index: number, isAI: boolean = false) {
  const config = getPlayerConfig(index);

  return {
    index,
    name: name.trim() || config.defaultName,
    color: config.colorStart,
    isAI
  };
}
