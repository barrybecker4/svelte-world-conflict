/**
 * Base Audio System for synthesized game sounds
 * Uses Web Audio API to generate sounds procedurally (no audio files needed)
 * 
 * This base class provides the core audio engine functionality.
 * Game-specific audio systems can extend or compose with this class.
 */

import type { EnvelopeParams, Note, SoundConfig } from './audioTypes';
import { calculateEnvelope, getEnvelopeDuration } from './envelopeUtils';

export class BaseAudioSystem {
    protected audioContext: AudioContext | null = null;
    protected isEnabled: boolean = true;
    protected volume: number = 0.5;
    protected isInitialized: boolean = false;

    constructor() {}

    /**
     * Creates an ADSR buffer for note-based sounds
     */
    createNoteBuffer(
        frequencies: Note[],
        volume: number,
        length: number
    ): AudioBuffer | null {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const samples = Math.floor(sampleRate * length);
        const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        const dt = 1 / sampleRate;

        const noteGenerators = frequencies.map(note => {
            const envelope: EnvelopeParams = {
                attackTime: 0.01,
                decayTime: 0.03,
                sustainTime: 0.03 * note.d,
                releaseTime: 0.03 * note.d,
                sustainLevel: 0.7
            };

            return {
                startTime: note.t,
                frequency: note.p,
                envelope,
                totalTime: getEnvelopeDuration(envelope),
                phase: 0
            };
        });

        for (let i = 0; i < samples; i++) {
            const time = i * dt;
            let sample = 0;

            for (const gen of noteGenerators) {
                if (time >= gen.startTime) {
                    const localTime = time - gen.startTime;

                    if (localTime < gen.totalTime) {
                        gen.phase += (2 * Math.PI * gen.frequency) / sampleRate;
                        const sineValue = Math.sin(gen.phase);
                        const envelope = calculateEnvelope(localTime, gen.envelope);
                        sample += sineValue * envelope;
                    }
                }
            }

            data[i] = sample * volume * this.volume;
        }

        return buffer;
    }

    /**
     * Creates a sliding pitch buffer for death/combat/whoosh sounds
     */
    createSlidingBuffer(
        startFreq: number,
        endFreq: number,
        volume: number,
        length: number
    ): AudioBuffer | null {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const samples = Math.floor(sampleRate * length);
        const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        const envelopeParams: EnvelopeParams = {
            attackTime: 0.01,
            decayTime: 0.05,
            sustainTime: 0.05,
            releaseTime: 0.05,
            sustainLevel: 0.5
        };
        const slideTime = 0.1;

        let phase = 0;

        for (let i = 0; i < samples; i++) {
            const time = i / sampleRate;
            const slideProgress = Math.min(time / slideTime, 1);
            const currentFreq = startFreq + (endFreq - startFreq) * slideProgress;

            phase += (2 * Math.PI * currentFreq) / sampleRate;
            const sineValue = Math.sin(phase);
            const envelope = calculateEnvelope(time, envelopeParams);

            data[i] = sineValue * envelope * volume * this.volume;
        }

        return buffer;
    }

    /**
     * Play a buffer through the audio context
     */
    playBuffer(buffer: AudioBuffer | null): void {
        if (!buffer || !this.audioContext) return;

        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start();
        } catch (e) {
            console.warn('Error playing sound:', e);
        }
    }

    /**
     * Create and play a buffer from a sound configuration
     */
    playSoundConfig(config: SoundConfig): void {
        let buffer: AudioBuffer | null = null;

        if (config.type === 'note') {
            buffer = this.createNoteBuffer(config.frequencies, config.volume, config.length);
        } else if (config.type === 'sliding') {
            buffer = this.createSlidingBuffer(config.startFreq, config.endFreq, config.volume, config.length);
        }

        this.playBuffer(buffer);
    }

    /**
     * Initialize Web Audio API
     */
    async initializeAudio(): Promise<void> {
        if (typeof window === 'undefined') return;
        if (this.isInitialized && this.audioContext) return;

        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            }

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
        } catch (error) {
            console.warn('Could not initialize audio:', error);
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

        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
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
     * Check if audio is currently enabled (regardless of initialization)
     */
    getIsEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Cleanup audio resources
     */
    cleanup(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}

