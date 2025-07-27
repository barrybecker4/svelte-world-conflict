export interface PlayerColorConfig {
  index: number;
  defaultName: string;
  colorStart: string;
  colorEnd: string;
  highlightStart: string;
  highlightEnd: string;
  // These should match the colors used in map regions
  mapColor: string;
  mapHighlight: string;
}

export const PLAYER_COLOR_CONFIGS: PlayerColorConfig[] = [
  {
    index: 0,
    defaultName: 'Amber',
    colorStart: '#e3be2d',
    colorEnd: '#e0b321',
    //colorStart: '#ffee88',    // Vivid yellow-gold
    //colorEnd: '#cc8811',      // Darker gold
    highlightStart: '#ffdd88',
    highlightEnd: '#aa8800',
    mapHighlight: '#ffdd88'
  },
  {
    index: 1,
    defaultName: 'Crimson',
    colorStart: '#dc2626',
    colorEnd: '#991b1b',
    //colorStart: '#ff8888',    // Vivid red
    //colorEnd: '#aa4444',      // Darker red
    highlightStart: '#ffaaaa',
    highlightEnd: '#994444',
    mapHighlight: '#ffaaaa'
  },
  {
    index: 2,
    defaultName: 'Lavender',
    colorStart: '#9A3BF2',
    colorEnd: '#7B68EE',
    //colorStart: '#dd99dd',    // Vivid purple
    //colorEnd: '#883388',      // Darker purple
    highlightStart: '#ffaaff',
    highlightEnd: '#775599',
    mapHighlight: '#ffaaff'
  },
  {
    index: 3,
    defaultName: 'Emerald',
    colorStart: '#059669',
    colorEnd: '#047857',
    //colorStart: '#99dd99',    // Vivid green
   // colorEnd: '#228822',      // Darker green
    highlightStart: '#bbffbb',
    highlightEnd: '#44aa44',
    mapHighlight: '#bbffbb'
  }
];


// Helper functions
export function getPlayerConfig(playerIndex: number): PlayerColorConfig {
  return PLAYER_COLOR_CONFIGS[playerIndex % PLAYER_COLOR_CONFIGS.length];
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
