import type { SoundConfig } from 'multiplayer-framework/shared';
import { VOLUME_LEVELS } from 'multiplayer-framework/shared';

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

// Volume levels matching original GAS version
const CLICK_VOLUME = VOLUME_LEVELS.UI;
const EFFECT_VOLUME = VOLUME_LEVELS.EFFECT;
const VICTORY_VOLUME = VOLUME_LEVELS.VICTORY;

// Default envelope timing for click sounds
const CLICK_LENGTH = 0.06; // ATTACK + DECAY + SUSTAIN + RELEASE

/**
 * Sound configurations for all game sounds
 */
export const SOUND_CONFIGS: Partial<Record<SoundType, SoundConfig>> = {
    // UI Sounds
    [SOUNDS.CLICK]: {
        type: 'note',
        frequencies: [{ t: 0, p: 110, d: 1 }],
        volume: CLICK_VOLUME,
        length: CLICK_LENGTH
    },
    [SOUNDS.HOVER]: {
        type: 'note',
        frequencies: [{ t: 0, p: 880, d: 0.5 }],
        volume: CLICK_VOLUME * 0.5,
        length: 0.03
    },
    [SOUNDS.ERROR]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 147, d: 2 },      // D3 - low
            { t: 0.15, p: 131, d: 2 }    // C3 - lower (dissonant)
        ],
        volume: EFFECT_VOLUME,
        length: 0.3
    },

    // Game Events
    [SOUNDS.GAME_CREATED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 261, d: 1 },      // C
            { t: 0.1, p: 329, d: 1.5 },  // E
            { t: 0.2, p: 392, d: 2 }     // G - welcoming major chord arpeggio
        ],
        volume: EFFECT_VOLUME,
        length: 0.4
    },
    [SOUNDS.GAME_STARTED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 392, d: 1 },      // G
            { t: 0.08, p: 440, d: 1 },   // A
            { t: 0.16, p: 494, d: 1.5 }, // B
            { t: 0.24, p: 523, d: 2 }    // C - ascending fanfare
        ],
        volume: EFFECT_VOLUME,
        length: 0.4
    },
    [SOUNDS.GAME_WON]: {
        type: 'note',
        frequencies: [
            // C major chord
            { t: 0, p: 261, d: 1 },    // C
            { t: 0, p: 329, d: 2 },    // E
            { t: 0, p: 392, d: 3 },    // G
            // F major chord
            { t: 0.2, p: 261, d: 1 },  // C
            { t: 0.2, p: 349, d: 2 },  // F
            { t: 0.2, p: 440, d: 3 }   // A
        ],
        volume: VICTORY_VOLUME,
        length: 0.5
    },
    [SOUNDS.GAME_LOST]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 392, d: 3 },      // G
            { t: 0.15, p: 329, d: 2 },   // E
            { t: 0.3, p: 261, d: 1 }     // C
        ],
        volume: VICTORY_VOLUME,
        length: 0.5
    },

    // Player Actions
    [SOUNDS.SOLDIERS_MOVE]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 294, d: 1 },      // D - first step
            { t: 0.08, p: 294, d: 1 }    // D - second step (marching)
        ],
        volume: EFFECT_VOLUME * 0.7,
        length: 0.2
    },
    [SOUNDS.SOLDIERS_RECRUITED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 349, d: 1.5 },    // F - recruitment call
            { t: 0.1, p: 392, d: 2 }     // G - response
        ],
        volume: EFFECT_VOLUME,
        length: 0.3
    },
    [SOUNDS.ATTACK]: {
        type: 'sliding',
        startFreq: 200,
        endFreq: 60,
        volume: EFFECT_VOLUME,
        length: 0.6
    },
    [SOUNDS.COMBAT]: {
        type: 'sliding',
        startFreq: 300,
        endFreq: 90,
        volume: EFFECT_VOLUME,
        length: 0.6
    },
    [SOUNDS.REGION_CONQUERED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 261, d: 1 },    // C
            { t: 0.1, p: 329, d: 2 }   // E
        ],
        volume: EFFECT_VOLUME,
        length: 0.2
    },
    [SOUNDS.TEMPLE_UPGRADED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 440, d: 1 },      // A
            { t: 0.06, p: 554, d: 1.5 }, // C#
            { t: 0.12, p: 659, d: 2 }    // E - mystical chord arpeggio
        ],
        volume: EFFECT_VOLUME,
        length: 0.25
    },

    // Economy
    [SOUNDS.INCOME]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 523, d: 1 },      // C5
            { t: 0.05, p: 659, d: 1.5 }  // E5 - pleasant rising chime
        ],
        volume: EFFECT_VOLUME,
        length: 0.2
    },

    // Time Warnings
    [SOUNDS.ALMOST_OUT_OF_TIME]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 492, d: 1 },      // B
            { t: 0.1, p: 349, d: 1 }     // F
        ],
        volume: EFFECT_VOLUME,
        length: 0.25
    },
    [SOUNDS.OUT_OF_TIME]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 452, d: 2 },
            { t: 0.1, p: 339, d: 2 },
            { t: 0.2, p: 452, d: 2 },
            { t: 0.3, p: 309, d: 2 }
        ],
        volume: EFFECT_VOLUME,
        length: 0.5
    }
};
