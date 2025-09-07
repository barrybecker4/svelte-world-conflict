import { writable, type Writable } from 'svelte/store';
import { audioSystem } from './AudioSystem';
import { SOUNDS, type SoundType } from './sounds';

interface AudioState {
  isEnabled: boolean;
  volume: number;
  isInitialized: boolean;
}

// Create reactive audio state
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

  // Toggle audio on/off
  const toggleAudio = async (): Promise<boolean> => {
    try {
      const newState = await audioSystem.toggle();

      audioState.update(state => ({
        ...state,
        isEnabled: newState
      }));

      // Play confirmation sound
      if (newState) {
        setTimeout(() => playUISound('CLICK'), 100);
      }

      return newState;
    } catch (error) {
      console.warn('Failed to toggle audio:', error);
      return false;
    }
  };

  // Set volume
  const setVolume = (volume: number): void => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioSystem.setVolume(clampedVolume);

    audioState.update(state => ({
      ...state,
      volume: clampedVolume
    }));
  };

  // Play game sounds
  const playGameSound = async (soundType: SoundType): Promise<void> => {
    try {
      await audioSystem.playSound(soundType);
    } catch (error) {
      console.warn(`Failed to play game sound ${soundType}:`, error);
    }
  };

  // Play UI sounds (click, hover, etc.)
  const playUISound = async (soundType: 'CLICK' | 'HOVER' | 'ERROR'): Promise<void> => {
    try {
      await audioSystem.playSound(soundType);
    } catch (error) {
      console.warn(`Failed to play UI sound ${soundType}:`, error);
    }
  };

  // Play special sound sequences
  const playVictoryFanfare = async (): Promise<void> => {
    try {
      await audioSystem.playVictoryFanfare();
    } catch (error) {
      console.warn('Failed to play victory fanfare:', error);
    }
  };

  const playDefeatSound = async (): Promise<void> => {
    try {
      await audioSystem.playDefeatSound();
    } catch (error) {
      console.warn('Failed to play defeat sound:', error);
    }
  };

  const playAttackSequence = async (): Promise<void> => {
    try {
      await audioSystem.playAttackSequence();
    } catch (error) {
      console.warn('Failed to play attack sequence:', error);
    }
  };

  const playTimeWarning = async (duration = 3000): Promise<void> => {
    try {
      await audioSystem.playTimeWarning(duration);
    } catch (error) {
      console.warn('Failed to play time warning:', error);
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
    playGameSound,
    playUISound,
    playVictoryFanfare,
    playDefeatSound,
    playAttackSequence,
    playTimeWarning,

    // Direct access to audio system
    audioSystem
  };
}
