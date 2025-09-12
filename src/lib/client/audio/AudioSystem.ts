export type SoundType = typeof SOUNDS[keyof typeof SOUNDS];

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
        [SOUNDS.COMBAT]: { frequency: 185, duration: 0.25, type: 'square' as OscillatorType },
        [SOUNDS.VICTORY]: { frequency: 523, duration: 0.5, type: 'sine' as OscillatorType },
        [SOUNDS.DEFEAT]: { frequency: 200, duration: 0.8, type: 'sawtooth' as OscillatorType },
        [SOUNDS.INCOME]: { frequency: 330, duration: 0.2, type: 'sine' as OscillatorType },
        [SOUNDS.UPGRADE]: { frequency: 400, duration: 0.3, type: 'triangle' as OscillatorType },
        [SOUNDS.OUT_OF_TIME]: { frequency: 180, duration: 1.0, type: 'square' as OscillatorType },
        [SOUNDS.ALMOST_OUT_OF_TIME]: { frequency: 250, duration: 0.15, type: 'triangle' as OscillatorType },
        [SOUNDS.GAME_CREATED]: { frequency: 392, duration: 0.4, type: 'sine' as OscillatorType }, // G4 - welcoming
        [SOUNDS.GAME_STARTED]: { frequency: 523, duration: 0.6, type: 'triangle' as OscillatorType }, // C5 - exciting start
        [SOUNDS.SOLDIERS_MOVE]: { frequency: 294, duration: 0.15, type: 'sine' as OscillatorType }, // D4 - marching sound

        [SOUNDS.REGION_CONQUERED]: { frequency: 659, duration: 0.4, type: 'triangle' as OscillatorType }, // E5 - triumphant
        [SOUNDS.GAME_WON]: { frequency: 784, duration: 0.8, type: 'sine' as OscillatorType }, // G5 - very triumphant
        [SOUNDS.GAME_LOST]: { frequency: 147, duration: 1.0, type: 'sawtooth' as OscillatorType }, // D3 - sad/low
        [SOUNDS.SOLDIERS_RECRUITED]: { frequency: 349, duration: 0.25, type: 'triangle' as OscillatorType }, // F4 - recruitment
        [SOUNDS.TEMPLE_UPGRADED]: { frequency: 440, duration: 0.35, type: 'sine' as OscillatorType }, // A4 - mystical upgrade
        
        // UI sounds
        [SOUNDS.CLICK]: { frequency: 800, duration: 0.05, type: 'sine' as OscillatorType },
        [SOUNDS.HOVER]: { frequency: 600, duration: 0.03, type: 'sine' as OscillatorType },
        [SOUNDS.ERROR]: { frequency: 120, duration: 0.4, type: 'square' as OscillatorType }
    } as const;

    constructor() {}

    /**
     * Play enhanced game creation fanfare
     */
    async playGameCreatedFanfare(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Play welcoming chord progression
        const notes = [392, 494, 587]; // G4, B4, D5
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.3, 'sine');
            }, i * 100);
        }
    }

    /**
     * Play game start fanfare 
     */
    async playGameStartFanfare(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Exciting ascending sequence
        const notes = [392, 440, 494, 523]; // G4, A4, B4, C5
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.2, 'triangle');
            }, i * 120);
        }
    }

    /**
     * Play soldiers marching sound
     */
    async playSoldiersMoving(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Quick marching rhythm
        await this.playTone(294, 0.08, 'sine'); // D4
        setTimeout(async () => {
            await this.playTone(294, 0.08, 'sine');
        }, 100);
    }

    /**
     * Play attack initiation sound
     */
    async playAttackInitiated(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Aggressive downward sweep
        await this.playTone(185, 0.15, 'square');
        setTimeout(async () => {
            await this.playTone(165, 0.1, 'square');
        }, 150);
    }

    /**
     * Play region conquest celebration
     */
    async playRegionConquered(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Triumphant rising notes
        const notes = [523, 659, 784]; // C5, E5, G5
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.2, 'triangle');
            }, i * 80);
        }
    }

    /**
     * Play ultimate victory fanfare
     */
    async playVictoryFanfare(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Epic victory sequence
        const notes = [523, 659, 784, 1047, 1319]; // C5, E5, G5, C6, E6
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.4, 'sine');
            }, i * 200);
        }
    }

    /**
     * Play sad defeat sound
     */
    async playDefeatSound(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Descending sad sequence
        const notes = [294, 262, 220, 196, 147]; // D4, C4, A3, G3, D3
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.3, 'sawtooth');
            }, i * 250);
        }
    }

    /**
     * Play soldier recruitment sound
     */
    async playSoldiersRecruited(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Military recruitment call
        await this.playTone(349, 0.15, 'triangle'); // F4
        setTimeout(async () => {
            await this.playTone(392, 0.1, 'triangle'); // G4
        }, 120);
    }

    /**
     * Play temple upgrade sound
     */
    async playTempleUpgraded(): Promise<void> {
        if (!this.isEnabled) return;
        
        // Mystical upgrade sound
        const notes = [440, 554, 659]; // A4, C#5, E5
        for (let i = 0; i < notes.length; i++) {
            setTimeout(async () => {
                await this.playTone(notes[i], 0.15, 'sine');
            }, i * 60);
        }
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

    cleanup(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.audioCache.clear();
        this.isInitialized = false;
    }

    /**
     * Core tone generation method (existing method)
     */
    private async playTone(frequency: number, duration: number, type: OscillatorType): Promise<void> {
        if (!this.audioContext) {
            await this.initializeAudio();
        }
        
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
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
     * Play a sound by type (enhanced existing method)
     */
    async playSound(soundType: SoundType): Promise<void> {
        if (!this.isEnabled) return;

        const config = this.soundConfig[soundType];
        if (!config) {
            console.warn(`Unknown sound type: ${soundType}`);
            return;
        }

        switch (soundType) {
            case SOUNDS.GAME_CREATED:
                return this.playGameCreatedFanfare();
            case SOUNDS.GAME_STARTED:
                return this.playGameStartFanfare();
            case SOUNDS.SOLDIERS_MOVE:
                return this.playSoldiersMoving();
            case SOUNDS.ATTACK:
                return this.playAttackInitiated();
            case SOUNDS.REGION_CONQUERED:
                return this.playRegionConquered();
            case SOUNDS.GAME_WON:
                return this.playVictoryFanfare();
            case SOUNDS.GAME_LOST:
                return this.playDefeatSound();
            case SOUNDS.SOLDIERS_RECRUITED:
                return this.playSoldiersRecruited();
            case SOUNDS.TEMPLE_UPGRADED:
                return this.playTempleUpgraded();
            default:
                // Use existing simple tone method for other sounds
                return this.playTone(config.frequency, config.duration, config.type);
        }
    }

}

// Export singleton instance
export const audioSystem = new AudioSystem();
