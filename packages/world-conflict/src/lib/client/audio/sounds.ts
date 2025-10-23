export const SOUNDS = {
    // Game events
    GAME_CREATED: 'created',
    GAME_STARTED: 'start',
    GAME_WON: 'victory',
    GAME_LOST: 'defeat',

    // Player actions
    SOLDIERS_MOVE: 'move',
    SOLDIERS_RECRUITED: 'recruit',
    ATTACK: 'attack',
    COMBAT: 'combat',
    REGION_CONQUERED: 'conquest',
    TEMPLE_UPGRADED: 'upgrade',

    // Economy
    INCOME: 'income',

    // Time warnings
    OUT_OF_TIME: 'out of time',
    ALMOST_OUT_OF_TIME: 'almost out of time',

    // UI sounds
    CLICK: 'click',
    HOVER: 'hover',
    ERROR: 'error'
} as const;

export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];
