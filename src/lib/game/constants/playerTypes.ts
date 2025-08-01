export const PLAYER_TYPES = {
    OFF: 'Off',
    HUMAN_SET: 'Set',
    HUMAN_OPEN: 'Open',
    AI: 'AI'
} as const;

export type PlayerType = typeof PLAYER_TYPES[keyof typeof PLAYER_TYPES];

export const AI_LEVEL_LABELS = ['Nice', 'Rude', 'Mean', 'Evil'] as const;
