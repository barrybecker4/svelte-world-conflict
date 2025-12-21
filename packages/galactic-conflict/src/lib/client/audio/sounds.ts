/**
 * Sound definitions for Galactic Conflict
 * Sci-fi themed synthesized sounds for space battles
 */

import type { SoundConfig } from 'multiplayer-framework/shared';
import { VOLUME_LEVELS } from 'multiplayer-framework/shared';

export const SOUNDS = {
    // Game events
    GAME_CREATED: 'created',
    GAME_STARTED: 'start',
    GAME_WON: 'victory',
    GAME_LOST: 'defeat',

    // Ship actions
    SHIP_LAUNCH: 'launch',
    SHIP_BUILT: 'build',
    ARMADA_ARRIVES: 'arrive',
    REINFORCEMENT_ARRIVED: 'reinforcement',

    // Battle sounds
    BATTLE_ALARM: 'alarm',
    SHIP_DESTROYED: 'destroyed',
    PLANET_CONQUERED: 'conquest',

    // UI sounds
    CLICK: 'click',
    HOVER: 'hover',
    ERROR: 'error'
} as const;

export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];

// Volume levels
const UI_VOLUME = VOLUME_LEVELS.UI;
const EFFECT_VOLUME = VOLUME_LEVELS.EFFECT;
const VICTORY_VOLUME = VOLUME_LEVELS.VICTORY;
const ALARM_VOLUME = 0.3;

// Default envelope timing for quick sounds
const QUICK_LENGTH = 0.08;

/**
 * Sound configurations for all game sounds
 * Sci-fi themed: electronic beeps, synth whooshes, pulsing alarms
 */
export const SOUND_CONFIGS: Partial<Record<SoundType, SoundConfig>> = {
    // UI Sounds - subtle electronic blips
    [SOUNDS.CLICK]: {
        type: 'note',
        frequencies: [{ t: 0, p: 880, d: 0.5 }],  // High A for sci-fi feel
        volume: UI_VOLUME,
        length: QUICK_LENGTH
    },
    [SOUNDS.HOVER]: {
        type: 'note',
        frequencies: [{ t: 0, p: 1760, d: 0.3 }],  // Very high blip
        volume: UI_VOLUME * 0.5,
        length: 0.03
    },
    [SOUNDS.ERROR]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 220, d: 2 },      // Low A - warning
            { t: 0.1, p: 185, d: 2 }     // F#3 - dissonant
        ],
        volume: EFFECT_VOLUME,
        length: 0.25
    },

    // Game Events
    [SOUNDS.GAME_CREATED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 523, d: 1 },      // C5 - computer startup
            { t: 0.08, p: 659, d: 1.5 }, // E5
            { t: 0.16, p: 784, d: 2 }    // G5 - ascending arpeggio
        ],
        volume: EFFECT_VOLUME,
        length: 0.4
    },
    [SOUNDS.GAME_STARTED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 392, d: 1 },      // G4 - launch countdown
            { t: 0.1, p: 523, d: 1 },    // C5
            { t: 0.2, p: 659, d: 1 },    // E5
            { t: 0.3, p: 784, d: 2 }     // G5 - ascending fanfare
        ],
        volume: EFFECT_VOLUME,
        length: 0.5
    },
    [SOUNDS.GAME_WON]: {
        type: 'note',
        frequencies: [
            // Triumphant chord progression
            { t: 0, p: 523, d: 2 },      // C5
            { t: 0, p: 659, d: 2 },      // E5
            { t: 0, p: 784, d: 3 },      // G5
            { t: 0.25, p: 587, d: 2 },   // D5
            { t: 0.25, p: 784, d: 2 },   // G5
            { t: 0.25, p: 988, d: 3 }    // B5 - victory swell
        ],
        volume: VICTORY_VOLUME,
        length: 0.6
    },
    [SOUNDS.GAME_LOST]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 392, d: 3 },      // G4 - descending
            { t: 0.2, p: 311, d: 2 },    // Eb4 - minor feel
            { t: 0.4, p: 262, d: 1 }     // C4 - defeat
        ],
        volume: VICTORY_VOLUME,
        length: 0.6
    },

    // Ship Actions
    [SOUNDS.SHIP_LAUNCH]: {
        type: 'sliding',
        startFreq: 200,
        endFreq: 800,
        volume: EFFECT_VOLUME,
        length: 0.4
    },
    [SOUNDS.SHIP_BUILT]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 1047, d: 1 },     // C6 - high beep
            { t: 0.06, p: 1319, d: 1.5 } // E6 - confirmation
        ],
        volume: EFFECT_VOLUME * 0.8,
        length: 0.2
    },
    [SOUNDS.ARMADA_ARRIVES]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 440, d: 1.5 },    // A4
            { t: 0.05, p: 554, d: 1 }    // C#5 - arrival chime
        ],
        volume: EFFECT_VOLUME,
        length: 0.2
    },
    [SOUNDS.REINFORCEMENT_ARRIVED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 523, d: 1.2 },    // C5 - friendly arrival
            { t: 0.08, p: 659, d: 1.5 },  // E5 - ascending
            { t: 0.16, p: 784, d: 1.8 }  // G5 - confirmation chime
        ],
        volume: EFFECT_VOLUME * 0.9,
        length: 0.35
    },

    // Battle Sounds
    [SOUNDS.BATTLE_ALARM]: {
        type: 'note',
        frequencies: [
            // Urgent klaxon - rapid alternating high/low with dissonance
            { t: 0, p: 880, d: 2 },       // A5 - high, sharp
            { t: 0, p: 932, d: 2 },       // Bb5 - slight dissonance for urgency
            { t: 0.1, p: 440, d: 2 },     // A4 - drop low
            { t: 0.2, p: 880, d: 2 },     // A5 - back high
            { t: 0.2, p: 932, d: 2 },     // Bb5 - dissonance
            { t: 0.3, p: 440, d: 2 },     // A4 - drop low
            { t: 0.4, p: 880, d: 2 },     // A5 - high
            { t: 0.4, p: 932, d: 2 },     // Bb5
            { t: 0.5, p: 440, d: 2 },     // A4 - low
            { t: 0.6, p: 880, d: 2.5 },   // A5 - final high
            { t: 0.6, p: 932, d: 2.5 },   // Bb5
        ],
        volume: ALARM_VOLUME * 1.5,
        length: 0.8
    },
    [SOUNDS.SHIP_DESTROYED]: {
        type: 'sliding',
        startFreq: 300,
        endFreq: 40,
        volume: EFFECT_VOLUME,
        length: 0.3
    },
    [SOUNDS.PLANET_CONQUERED]: {
        type: 'note',
        frequencies: [
            { t: 0, p: 523, d: 1.5 },    // C5
            { t: 0.1, p: 659, d: 2 },    // E5
            { t: 0.2, p: 784, d: 2.5 }   // G5 - victory stinger
        ],
        volume: EFFECT_VOLUME * 1.2,
        length: 0.4
    }
};

/**
 * Icon mapping for sound test modal
 */
export const SOUND_ICONS: Record<string, string> = {
    GAME_CREATED: '🎮',
    GAME_STARTED: '🚀',
    GAME_WON: '🏆',
    GAME_LOST: '💀',
    SHIP_LAUNCH: '🛸',
    SHIP_BUILT: '🔧',
    ARMADA_ARRIVES: '📍',
    REINFORCEMENT_ARRIVED: '✅',
    BATTLE_ALARM: '🚨',
    SHIP_DESTROYED: '💥',
    PLANET_CONQUERED: '🌍',
    CLICK: '👆',
    HOVER: '🔘',
    ERROR: '❌'
};
