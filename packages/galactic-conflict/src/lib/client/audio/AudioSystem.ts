/**
 * Audio system for Galactic Conflict game
 * Provides sci-fi themed sound effects using Web Audio API synthesis
 */

import { SOUNDS, SOUND_CONFIGS, type SoundType } from './sounds';
import { BaseAudioSystem } from 'multiplayer-framework/shared';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';

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
     * Play battle start sequence - alarm followed by combat sounds
     */
    async playBattleStart(): Promise<void> {
        if (!this.getIsEnabled()) return;

        await this.playSound(SOUNDS.BATTLE_ALARM);
    }

    /**
     * Play ship destruction sound - can be called multiple times for casualties
     */
    async playShipDestroyed(): Promise<void> {
        if (!this.getIsEnabled()) return;

        await this.playSound(SOUNDS.SHIP_DESTROYED);
    }

    /**
     * Play a sequence of destruction sounds with delays
     * @param count Number of ships destroyed
     * @param delayMs Delay between sounds
     */
    async playDestructionSequence(count: number, delayMs: number = 150): Promise<void> {
        if (!this.getIsEnabled()) return;

        for (let i = 0; i < Math.min(count, 5); i++) { // Cap at 5 sounds to avoid noise
            setTimeout(() => {
                this.playShipDestroyed();
            }, i * delayMs);
        }
    }

    /**
     * Play conquest fanfare when a planet is taken
     */
    async playConquest(): Promise<void> {
        if (!this.getIsEnabled()) return;

        await this.playSound(SOUNDS.PLANET_CONQUERED);
    }
}

export const audioSystem = new AudioSystem();
