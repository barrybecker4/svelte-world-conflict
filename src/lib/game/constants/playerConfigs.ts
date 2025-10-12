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
    colorStart: '#4ade80',  // Bright green
    colorEnd: '#4ade80',    // Flat color (same as start)
    highlightStart: '#6ee7a3',
    highlightEnd: '#6ee7a3',
  },
  {
    slotIndex: 1,
    defaultName: 'Crimson',
    colorStart: '#ef4444', // Bright red
    colorEnd: '#ef4444',   // Flat color (same as start)
    highlightStart: '#f87171',
    highlightEnd: '#f87171',
  },
  {
    slotIndex: 2,
    defaultName: 'Amber',
    colorStart: '#facc15', // Bright yellow
    colorEnd: '#facc15',   // Flat color (same as start)
    highlightStart: '#fde047',
    highlightEnd: '#fde047',
  },
  {
    slotIndex: 3,
    defaultName: 'Lavender',
    colorStart: '#a78bfa', // Bright lavender/purple
    colorEnd: '#a78bfa',   // Flat color (same as start)
    highlightStart: '#c4b5fd',
    highlightEnd: '#c4b5fd',
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
