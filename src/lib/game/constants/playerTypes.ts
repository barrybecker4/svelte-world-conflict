export const PLAYER_TYPES = {
    OFF: 'Off',
    HUMAN_SET: 'Set',
    HUMAN_OPEN: 'Open',
    AI: 'AI'
} as const;

export type PlayerType = typeof PLAYER_TYPES[keyof typeof PLAYER_TYPES];

export const AI_LEVEL_LABELS = ['Nice', 'Rude', 'Mean', 'Evil'] as const;

export interface PlayerConfig {
    index: number;
    defaultName: string;
    colorStart: string;
    colorEnd: string;
    highlightStart: string;
    highlightEnd: string;
}

export const PLAYER_CONFIGS: PlayerConfig[] = [
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
