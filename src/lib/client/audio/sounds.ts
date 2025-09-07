export const SOUNDS = {
    START: 'start',
    MOVE: 'move',
    ATTACK: 'attack',
    VICTORY: 'victory',
    DEFEAT: 'defeat',
    INCOME: 'income',
    UPGRADE: 'upgrade',
    OUT_OF_TIME: 'OUT_OF_TIME',
    ALMOST_OUT_OF_TIME: 'ALMOST_OUT_OF_TIME'
} as const;

export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];
