export const SOUNDS = {
    GAME_CREATED: 'created',
    GAME_STARTED: 'start',
    START: 'start',
    SOLDIERS_MOVE: 'move',
    COMBAT: 'combat',
    ATTACK: 'attack',
    REGION_CONQUERED: 'conquest',
    GAME_WON: 'victory',
    GAME_LOST: 'defeat',
    SOLDIERS_RECRUITED: 'recruit',
    TEMPLE_UPGRADED: 'upgrade',
    VICTORY: 'victory',
    DEFEAT: 'defeat',
    INCOME: 'income',
    UPGRADE: 'upgrade',
    OUT_OF_TIME: 'OUT_OF_TIME',
    ALMOST_OUT_OF_TIME: 'ALMOST_OUT_OF_TIME'
} as const;

export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];
