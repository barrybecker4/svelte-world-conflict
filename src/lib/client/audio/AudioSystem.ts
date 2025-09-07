import { SOUNDS, type SoundType } from './sounds';

/**
 * Audio system for World Conflict game
 * Provides sound effects similar to the original GAS version
 */
export class AudioSystem {
    private audioContext: AudioContext | null = null;
    private isEnabled: boolean = true;
    private volume: number = 0.5;
    private audioCache: Map<SoundType, AudioBuffer> = new Map();
    private isInitialized: boolean = false;

    // Sound frequencies and durations (similar to original GAS simple sounds)
    private readonly soundConfig = {
        [SOUNDS.START]: { frequency: 440, duration: 0.3, type: 'sine' as OscillatorType },
        [SOUNDS.MOVE]: { frequency: 220, duration: 0.1, type: 'sine' as OscillatorType },
        [SOUNDS.ATTACK]: { frequency: 150, duration: 0.2, type: 'square' as OscillatorType },
        [SOUNDS.VICTORY]: { frequency: 523, duration: 0.5, type: 'sine' as OscillatorType },
        [SOUNDS.DEFEAT]: { frequency: 200, duration: 0.8, type: 'sawtooth' as OscillatorType },
        [SOUNDS.INCOME]: { frequency: 330, duration: 0.2, type: 'sine' as OscillatorType },
        [SOUNDS.UPGRADE]: { frequency: 400, duration: 0.3, type: 'triangle' as OscillatorType },
        [SOUNDS.OUT_OF_TIME]: { frequency: 180, duration: 1.0, type: 'square' as OscillatorType },
        [SOUNDS.ALMOST_OUT_OF_TIME]: { frequency: 250, duration: 0.15, type: 'triangle' as OscillatorType },
        // Additional sounds for UI interactions
        'CLICK': { frequency: 800, duration: 0.05, type: 'sine' as OscillatorType },
        'HOVER': { frequency: 600, duration: 0.03, type: 'sine' as OscillatorType },
        'ERROR': { frequency: 120, duration: 0.4, type: 'square' as OscillatorType }
    } as const;

    constructor() {
    }

    /**
     * Initialize Web Audio API
     */
    private async initializeAudio(): Promise<void> {
        if (typeof window === 'undefined') {
            console.log('AudioSystem: Skipping initialization - not in browser environment');
            return;
        }
        try {
            // Create audio context on first user interaction
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            // Ensure audio context is running
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
            console.log('🔊 Audio system initialized');
        } catch (error) {
            console.warn('⚠️ Could not initialize audio:', error);
            this.isInitialized = false;
        }
    }

    /**
     * Enable audio (must be called after user interaction)
     */
    async enable(): Promise<void> {
        this.isEnabled = true;
        if (!this.isInitialized) {
            await this.initializeAudio();
        }

        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                console.log('🔊 Audio context resumed');
            } catch (error) {
                console.warn('Could not resume audio context:', error);
            }
        }
    }

    /**
     * Disable audio
     */
    disable(): void {
        this.isEnabled = false;
    }

    /**
     * Toggle audio on/off
     */
    async toggle(): Promise<boolean> {
        if (this.isEnabled) {
            this.disable();
        } else {
            await this.enable();
        }
        return this.isEnabled;
    }

    /**
     * Set volume (0.0 to 1.0)
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Get current volume
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * Check if audio is enabled
     */
    isAudioEnabled(): boolean {
        return this.isEnabled && this.isInitialized;
    }

    /**
     * Play a sound by type
     */
    async playSound(soundType: SoundType | 'CLICK' | 'HOVER' | 'ERROR'): Promise<void> {
        if (!this.isEnabled || !this.isInitialized || !this.audioContext) {
            return;
        }

        const config = this.soundConfig[soundType as keyof typeof this.soundConfig];
        if (!config) {
            console.warn(`Unknown sound type: ${soundType}`);
            return;
        }

        try {
            await this.playTone(config.frequency, config.duration, config.type);
        } catch (error) {
            console.warn(`Could not play sound ${soundType}:`, error);
        }
    }

    /**
     * Play a tone with specified frequency and duration
     */
    private async playTone(
        frequency: number,
        duration: number,
        type: OscillatorType = 'sine'
    ): Promise<void> {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Configure oscillator
        oscillator.frequency.value = frequency;
        oscillator.type = type;

        // Configure volume envelope
        const currentTime = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume, currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(this.volume, currentTime + duration * 0.8);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

        // Play sound
        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
    }

    /**
     * Play attack sequence with multiple sounds
     */
    async playAttackSequence(): Promise<void> {
        if (!this.isEnabled) return;

        // Play a sequence of tones for attack
        await this.playSound(SOUNDS.ATTACK);
        setTimeout(async () => {
            if (Math.random() > 0.5) {
                await this.playSound(SOUNDS.ATTACK);
            }
        }, 200);
    }

    /**
     * Play victory fanfare
     */
    async playVictoryFanfare(): Promise<void> {
        if (!this.isEnabled) return;

        // Play a sequence of ascending tones
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.3, 'sine');
            }, i * 200);
        }
    }

    /**
     * Play defeat sound
     */
    async playDefeatSound(): Promise<void> {
        if (!this.isEnabled) return;

        // Play a descending tone sequence
        const notes = [400, 350, 300, 250, 200];
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.2, 'sawtooth');
            }, i * 150);
        }
    }

    /**
     * Play time warning sound (repeating)
     */
    async playTimeWarning(duration: number = 3000): Promise<void> {
        if (!this.isEnabled) return;

        const interval = setInterval(async () => {
            await this.playSound(SOUNDS.ALMOST_OUT_OF_TIME);
        }, 500);

        setTimeout(() => {
            clearInterval(interval);
        }, duration);
    }

    /**
     * Cleanup audio resources
     */
    cleanup(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.audioCache.clear();
        this.isInitialized = false;
    }
}

// Export singleton instance
export const audioSystem = new AudioSystem();