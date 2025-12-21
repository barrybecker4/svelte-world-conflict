/**
 * Svelte composable for managing audio in Galactic Conflict
 */

import { writable, type Writable } from 'svelte/store';
import { audioSystem } from './AudioSystem';
import { SOUNDS, type SoundType } from './sounds';

interface AudioState {
    isEnabled: boolean;
    volume: number;
    isInitialized: boolean;
}

export const audioState: Writable<AudioState> = writable({
    isEnabled: false,
    volume: 0.5,
    isInitialized: false
});

/**
 * Composable for managing audio in Svelte components
 */
export function useAudio() {

    const initializeAudio = async () => {
        try {
            const isEnabled = audioSystem.isAudioEnabled();
            const volume = audioSystem.getVolume();

            audioState.update(state => ({
                ...state,
                isEnabled,
                volume,
                isInitialized: true
            }));
        } catch (error) {
            console.warn('Failed to initialize audio state:', error);
        }
    };

    const toggleAudio = async (): Promise<boolean> => {
        try {
            const newState = await audioSystem.toggle();

            audioState.update(state => ({
                ...state,
                isEnabled: newState
            }));

            // Play confirmation sound
            if (newState) {
                setTimeout(() => playSound(SOUNDS.CLICK), 100);
            }

            return newState;
        } catch (error) {
            console.warn('Failed to toggle audio:', error);
            return false;
        }
    };

    const setVolume = (volume: number): void => {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        audioSystem.setVolume(clampedVolume);

        audioState.update(state => ({
            ...state,
            volume: clampedVolume
        }));
    };

    const playSound = async (soundType: SoundType): Promise<void> => {
        try {
            await audioSystem.playSound(soundType);
        } catch (error) {
            console.warn(`Failed to play sound ${soundType}:`, error);
        }
    };

    const playBattleStart = async (): Promise<void> => {
        try {
            await audioSystem.playBattleStart();
        } catch (error) {
            console.warn('Failed to play battle start:', error);
        }
    };

    const playShipDestroyed = async (): Promise<void> => {
        try {
            await audioSystem.playShipDestroyed();
        } catch (error) {
            console.warn('Failed to play ship destroyed:', error);
        }
    };

    const playConquest = async (): Promise<void> => {
        try {
            await audioSystem.playConquest();
        } catch (error) {
            console.warn('Failed to play conquest:', error);
        }
    };

    return {
        // State
        audioState,

        // Actions
        initializeAudio,
        toggleAudio,
        setVolume,

        // Sound playback
        playSound,
        playBattleStart,
        playShipDestroyed,
        playConquest,

        // Sound types for convenience
        SOUNDS,

        // Direct access to audio system
        audioSystem
    };
}
