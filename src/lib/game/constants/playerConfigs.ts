export interface PlayerColorConfig {
  index: number;
  defaultName: string;
  colorStart: string;
  colorEnd: string;
  highlightStart: string;
  highlightEnd: string;
}

export const PLAYER_CONFIGS: PlayerColorConfig[] = [
  {
    index: 0,
    defaultName: 'Amber',
    colorStart: '#e6bf2d',  // Vivid yellow-gold
    colorEnd: '#daab1a',    // Darker gold
    highlightStart: '#f2db77',
    highlightEnd: '#dfb020',
  },
  {
    index: 1,
    defaultName: 'Crimson',
    colorStart: '#dc2626', // Vivid red
    colorEnd: '#991b1b', // Darker red
    highlightStart: '#ffaaaa',
    highlightEnd: '#994444',
  },
  {
    index: 2,
    defaultName: 'Lavender',
    colorStart: '#9A3BF2', // Vivid purple
    colorEnd: '#7B68EE', // Darker purple
    highlightStart: '#ffaaff',
    highlightEnd: '#775599',
  },
  {
    index: 3,
    defaultName: 'Emerald',
    colorStart: '#059669', // Vivid green
    colorEnd: '#047857', // Darker green
    highlightStart: '#bbffbb',
    highlightEnd: '#44aa44',
  }
];


// Helper functions
export function getPlayerConfig(playerIndex: number): PlayerColorConfig {
  return PLAYER_CONFIGS[playerIndex % PLAYER_CONFIGS.length];
}

export function getPlayerColor(playerIndex: number): string {
  return getPlayerConfig(playerIndex).colorStart;
}

export function getPlayerMapColor(playerIndex: number): string {
  return getPlayerConfig(playerIndex).colorStart;
}

export function getPlayerHighlightColor(playerIndex: number): string {
  return getPlayerConfig(playerIndex).highlightStart;
}

export function getPlayerEndColor(playerIndex: number): string {
  return getPlayerConfig(playerIndex).colorEnd;
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
