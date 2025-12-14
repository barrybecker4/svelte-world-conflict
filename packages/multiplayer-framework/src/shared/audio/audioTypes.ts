/**
 * Audio type definitions for the synthesized sound system
 * Used by both world-conflict and galactic-conflict games
 */

/**
 * ADSR envelope parameters for sound shaping
 */
export interface EnvelopeParams {
    attackTime: number;
    decayTime: number;
    sustainTime: number;
    releaseTime: number;
    sustainLevel: number;
}

/**
 * Note definition: time offset, pitch (Hz), duration multiplier
 */
export interface Note {
    /** Time offset from start (seconds) */
    t: number;
    /** Pitch in Hz */
    p: number;
    /** Duration multiplier */
    d: number;
}

/**
 * Configuration for note-based sounds (musical tones)
 */
export interface NoteSoundConfig {
    type: 'note';
    frequencies: Note[];
    volume: number;
    length: number;
}

/**
 * Configuration for sliding pitch sounds (whooshes, explosions)
 */
export interface SlidingSoundConfig {
    type: 'sliding';
    startFreq: number;
    endFreq: number;
    volume: number;
    length: number;
}

/**
 * Union type for all sound configurations
 */
export type SoundConfig = NoteSoundConfig | SlidingSoundConfig;

/**
 * Standard volume levels for different sound categories
 */
export const VOLUME_LEVELS = {
    UI: 0.1,
    EFFECT: 0.2,
    VICTORY: 0.6,
} as const;

