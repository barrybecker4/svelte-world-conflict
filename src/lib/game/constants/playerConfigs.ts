import type { Player } from '$lib/game/entities/gameTypes';

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
    defaultName: 'Emerald',
    colorStart: '#9d9',
    colorEnd: '#282',
    highlightStart: '#bfb',
    highlightEnd: '#4a4',
  },
  {
    slotIndex: 1,
    defaultName: 'Crimson',
    colorStart: '#f88',
    colorEnd: '#a44',
    highlightStart: '#faa',
    highlightEnd: '#944',
  },
  {
    slotIndex: 2,
    defaultName: 'Amber',
    colorStart: '#ffe680',
    colorEnd: '#d4a944',
    highlightStart: '#daa520',
    highlightEnd: '#b8860b',
  },
  {
    slotIndex: 3,
    defaultName: 'Lavender',
    colorStart: '#d9d',
    colorEnd: '#838',
    highlightStart: '#faf',
    highlightEnd: '#759',
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
export function createPlayerWithColors(name: string, slotIndex: number, isAI: boolean = false): Player {
  const config = getPlayerConfig(slotIndex);

  return {
    slotIndex,
    name: name.trim() || config.defaultName,
    color: config.colorStart,
    isAI
  };
}
