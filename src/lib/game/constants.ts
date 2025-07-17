export const PLAYER_TYPES = {
    OFF: 'Off',
    HUMAN_SET: 'Set',
    HUMAN_OPEN: 'Open',
    AI: 'AI'
} as const;

export const AI_LEVELS = {
    NICE: 0,
    RUDE: 1,
    MEAN: 2,
    EVIL: 3
} as const;

export const GAME_DEFAULTS = {
    TURN_COUNT: 10,
    UNLIMITED_TURNS: 1000000,
    HUMAN_TIME_LIMIT: 30,
    UNLIMITED_TIME: 3600,
    MAP_SIZE: "Medium",
    BASE_MOVES_PER_TURN: 3
} as const;

export const SOUNDS = {
    CLICK: 'CLICK',
    ENEMY_DEAD: 'ENEMY_DEAD',
    OURS_DEAD: 'OURS_DEAD',
    TAKE_OVER: 'TAKE_OVER',
    VICTORY: 'VICTORY',
    DEFEAT: 'DEFEAT',
    OUT_OF_TIME: 'OUT_OF_TIME',
    ALMOST_OUT_OF_TIME: 'ALMOST_OUT_OF_TIME'
} as const;

// Calculate soldier costs (8, 9, 10, 11... up to n)
function calcSoldierCosts(initial: number, count: number): number[] {
    return Array(count).fill(0).map((_, i) => initial + i);
}

export interface UpgradeData {
    name: string;
    desc: string;
    cost: number[];
    level: number[];
    bgColor?: string;
    index: number;
}

// Temple upgrades
export const UPGRADES: Record<string, UpgradeData> = {
    SOLDIER: {
        name: 'Extra soldier',
        desc: '',
        cost: calcSoldierCosts(8, 16),
        level: [],
        index: 1,
    },
    WATER: {
        name: 'X of Water',
        desc: 'Income: X% more each turn.',
        cost: [15, 25],
        level: [20, 40],
        bgColor: '#66f',
        index: 2,
    },
    FIRE: {
        name: 'X of Fire',
        desc: 'Attack: X invincible soldier(s).',
        cost: [20, 30],
        level: [1, 2],
        bgColor: '#f88',
        index: 3,
    },
    AIR: {
        name: 'X of Air',
        desc: 'Move: X extra move(s) per turn.',
        cost: [25, 35],
        level: [1, 2],
        bgColor: '#ffa',
        index: 4,
    },
    EARTH: {
        name: 'X of Earth',
        desc: 'Defense: Always kill X invader(s).',
        cost: [30, 45],
        level: [1, 2],
        bgColor: '#696',
        index: 5,
    },
    REBUILD: {
        name: 'Rebuild temple',
        desc: 'Switch to a different upgrade.',
        cost: [0],
        level: [],
        index: 6,
    }
} as const;

// Default player configurations
export interface PlayerConfig {
    index: number;
    defaultName: string;
    colorStart: string;
    colorEnd: string;
    highlightStart: string;
    highlightEnd: string;
}

export const DEFAULT_PLAYERS: PlayerConfig[] = [
    {
        index: 0,
        defaultName: 'Amber',
        colorStart: '#fe8',
        colorEnd: '#c81',
        highlightStart: '#fd8',
        highlightEnd: '#a80'
    },
    {
        index: 1,
        defaultName: 'Crimson',
        colorStart: '#f88',
        colorEnd: '#a44',
        highlightStart: '#faa',
        highlightEnd: '#944'
    },
    {
        index: 2,
        defaultName: 'Lavender',
        colorStart: '#d9d',
        colorEnd: '#838',
        highlightStart: '#faf',
        highlightEnd: '#759'
    },
    {
        index: 3,
        defaultName: 'Emerald',
        colorStart: '#9d9',
        colorEnd: '#282',
        highlightStart: '#bfb',
        highlightEnd: '#4a4'
    }
] as const;

// AI Personality configurations
export interface AiPersonalityConfig {
    name: string;
    soldierEagerness: number;
    upgradePreference: number[];
    level: number;
}

export const AI_PERSONALITIES: AiPersonalityConfig[] = [
    {
        name: 'Defender',
        soldierEagerness: 0.5,
        upgradePreference: [UPGRADES.EARTH.index, UPGRADES.WATER.index, UPGRADES.FIRE.index],
        level: AI_LEVELS.NICE
    },
    {
        name: 'Economist',
        soldierEagerness: 0.3,
        upgradePreference: [UPGRADES.WATER.index, UPGRADES.AIR.index, UPGRADES.EARTH.index],
        level: AI_LEVELS.RUDE
    },
    {
        name: 'Aggressor',
        soldierEagerness: 0.8,
        upgradePreference: [UPGRADES.FIRE.index, UPGRADES.AIR.index, UPGRADES.WATER.index],
        level: AI_LEVELS.MEAN
    },
    {
        name: 'Berserker',
        soldierEagerness: 1.0,
        upgradePreference: [UPGRADES.FIRE.index, UPGRADES.FIRE.index, UPGRADES.AIR.index],
        level: AI_LEVELS.EVIL
    }
] as const;

// Export type unions for better TypeScript support
export type PlayerType = typeof PLAYER_TYPES[keyof typeof PLAYER_TYPES];
export type AiLevel = typeof AI_LEVELS[keyof typeof AI_LEVELS];
export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];
export type UpgradeType = keyof typeof UPGRADES;
