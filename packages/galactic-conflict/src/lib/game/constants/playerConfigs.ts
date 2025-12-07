import type { Player } from '$lib/game/entities/gameTypes';

export interface PlayerColorConfig {
  slotIndex: number;
  defaultName: string;
  colorStart: string;
  colorEnd: string;
  highlightStart: string;
  highlightEnd: string;
}

/**
 * Player configurations for up to 20 players
 * Each has unique colors and default names themed around space/stars
 */
export const PLAYER_CONFIGS: PlayerColorConfig[] = [
  {
    slotIndex: 0,
    defaultName: 'Nova',
    colorStart: '#ef4444',
    colorEnd: '#b91c1c',
    highlightStart: '#f87171',
    highlightEnd: '#dc2626',
  },
  {
    slotIndex: 1,
    defaultName: 'Nebula',
    colorStart: '#3b82f6',
    colorEnd: '#1d4ed8',
    highlightStart: '#60a5fa',
    highlightEnd: '#2563eb',
  },
  {
    slotIndex: 2,
    defaultName: 'Aurora',
    colorStart: '#22c55e',
    colorEnd: '#15803d',
    highlightStart: '#4ade80',
    highlightEnd: '#16a34a',
  },
  {
    slotIndex: 3,
    defaultName: 'Solaris',
    colorStart: '#eab308',
    colorEnd: '#a16207',
    highlightStart: '#facc15',
    highlightEnd: '#ca8a04',
  },
  {
    slotIndex: 4,
    defaultName: 'Cosmos',
    colorStart: '#a855f7',
    colorEnd: '#7c3aed',
    highlightStart: '#c084fc',
    highlightEnd: '#8b5cf6',
  },
  {
    slotIndex: 5,
    defaultName: 'Pulsar',
    colorStart: '#ec4899',
    colorEnd: '#be185d',
    highlightStart: '#f472b6',
    highlightEnd: '#db2777',
  },
  {
    slotIndex: 6,
    defaultName: 'Quasar',
    colorStart: '#06b6d4',
    colorEnd: '#0e7490',
    highlightStart: '#22d3ee',
    highlightEnd: '#0891b2',
  },
  {
    slotIndex: 7,
    defaultName: 'Comet',
    colorStart: '#f97316',
    colorEnd: '#c2410c',
    highlightStart: '#fb923c',
    highlightEnd: '#ea580c',
  },
  {
    slotIndex: 8,
    defaultName: 'Vortex',
    colorStart: '#14b8a6',
    colorEnd: '#0f766e',
    highlightStart: '#2dd4bf',
    highlightEnd: '#0d9488',
  },
  {
    slotIndex: 9,
    defaultName: 'Stellar',
    colorStart: '#8b5cf6',
    colorEnd: '#6d28d9',
    highlightStart: '#a78bfa',
    highlightEnd: '#7c3aed',
  },
  {
    slotIndex: 10,
    defaultName: 'Zenith',
    colorStart: '#f43f5e',
    colorEnd: '#be123c',
    highlightStart: '#fb7185',
    highlightEnd: '#e11d48',
  },
  {
    slotIndex: 11,
    defaultName: 'Eclipse',
    colorStart: '#0ea5e9',
    colorEnd: '#0369a1',
    highlightStart: '#38bdf8',
    highlightEnd: '#0284c7',
  },
  {
    slotIndex: 12,
    defaultName: 'Meteor',
    colorStart: '#84cc16',
    colorEnd: '#4d7c0f',
    highlightStart: '#a3e635',
    highlightEnd: '#65a30d',
  },
  {
    slotIndex: 13,
    defaultName: 'Galaxy',
    colorStart: '#d946ef',
    colorEnd: '#a21caf',
    highlightStart: '#e879f9',
    highlightEnd: '#c026d3',
  },
  {
    slotIndex: 14,
    defaultName: 'Orbit',
    colorStart: '#fbbf24',
    colorEnd: '#b45309',
    highlightStart: '#fcd34d',
    highlightEnd: '#d97706',
  },
  {
    slotIndex: 15,
    defaultName: 'Astral',
    colorStart: '#10b981',
    colorEnd: '#047857',
    highlightStart: '#34d399',
    highlightEnd: '#059669',
  },
  {
    slotIndex: 16,
    defaultName: 'Lunar',
    colorStart: '#6366f1',
    colorEnd: '#4338ca',
    highlightStart: '#818cf8',
    highlightEnd: '#4f46e5',
  },
  {
    slotIndex: 17,
    defaultName: 'Flare',
    colorStart: '#fb923c',
    colorEnd: '#c2410c',
    highlightStart: '#fdba74',
    highlightEnd: '#ea580c',
  },
  {
    slotIndex: 18,
    defaultName: 'Prism',
    colorStart: '#2dd4bf',
    colorEnd: '#0f766e',
    highlightStart: '#5eead4',
    highlightEnd: '#0d9488',
  },
  {
    slotIndex: 19,
    defaultName: 'Void',
    colorStart: '#c084fc',
    colorEnd: '#7c3aed',
    highlightStart: '#d8b4fe',
    highlightEnd: '#8b5cf6',
  },
];

/** Neutral planet color configuration */
export const NEUTRAL_CONFIG: PlayerColorConfig = {
  slotIndex: -1,
  defaultName: 'Neutral',
  colorStart: '#6b7280',
  colorEnd: '#4b5563',
  highlightStart: '#9ca3af',
  highlightEnd: '#6b7280',
};

// Helper functions
export function getPlayerConfig(playerSlotIndex: number | null): PlayerColorConfig {
  if (playerSlotIndex === null || playerSlotIndex < 0) {
    return NEUTRAL_CONFIG;
  }
  return PLAYER_CONFIGS[playerSlotIndex % PLAYER_CONFIGS.length];
}

export function getPlayerColor(playerSlotIndex: number | null): string {
  return getPlayerConfig(playerSlotIndex).colorStart;
}

export function getPlayerMapColor(playerSlotIndex: number | null): string {
  return getPlayerConfig(playerSlotIndex).colorStart;
}

export function getPlayerHighlightColor(playerSlotIndex: number | null): string {
  return getPlayerConfig(playerSlotIndex).highlightStart;
}

export function getPlayerEndColor(playerSlotIndex: number | null): string {
  return getPlayerConfig(playerSlotIndex).colorEnd;
}

export function getPlayerDefaultName(playerSlotIndex: number): string {
  return getPlayerConfig(playerSlotIndex).defaultName;
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

