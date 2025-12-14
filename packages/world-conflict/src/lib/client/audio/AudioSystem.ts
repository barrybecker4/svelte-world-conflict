import { SOUNDS, SOUND_CONFIGS, type SoundType } from './sounds';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { BaseAudioSystem } from 'multiplayer-framework/shared';

/**
 * Audio system for World Conflict game
 * Provides sound effects matching the original GAS version with ADSR envelopes
 * Extends the shared BaseAudioSystem with game-specific functionality
 */
export class AudioSystem extends BaseAudioSystem {
    constructor() {
        super();
    }

    /**
     * Play a sound by type
     */
    async playSound(soundType: SoundType): Promise<void> {
        if (!this.getIsEnabled()) return;

        await this.initializeAudio();

        const config = SOUND_CONFIGS[soundType];
        if (config) {
            this.playSoundConfig(config);
        } else {
            console.warn(`Unknown sound type: ${soundType}`);
        }
    }

    /**
     * Play attack sequence with multiple sounds
     */
    async playAttackSequence(): Promise<void> {
        if (!this.getIsEnabled()) return;

        await this.playSound(SOUNDS.ATTACK);
        setTimeout(async () => {
            await this.playSound(SOUNDS.COMBAT);
        }, GAME_CONSTANTS.QUICK_ANIMATION_MS);
    }

    /**
     * Play time warning sound (repeating)
     */
    async playTimeWarning(duration: number = GAME_CONSTANTS.AUDIO_WARNING_DURATION_MS): Promise<void> {
        if (!this.getIsEnabled()) return;

        const startTime = Date.now();
        const playWarning = async () => {
            if (Date.now() - startTime < duration) {
                await this.playSound(SOUNDS.ALMOST_OUT_OF_TIME);
                setTimeout(playWarning, GAME_CONSTANTS.AUDIO_WARNING_REPEAT_MS);
            }
        };
        playWarning();
    }
}

export const audioSystem = new AudioSystem();
