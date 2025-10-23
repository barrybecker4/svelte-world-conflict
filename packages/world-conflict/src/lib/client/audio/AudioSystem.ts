import { SOUNDS, type SoundType } from './sounds';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Audio system for World Conflict game
 * Provides sound effects matching the original GAS version with ADSR envelopes
 */
export class AudioSystem {
    private audioContext: AudioContext | null = null;
    private isEnabled: boolean = true;
    private volume: number = 0.5;
    private audioCache: Map<SoundType, AudioBuffer> = new Map();
    private isInitialized: boolean = false;

    // Volume levels matching original GAS version
    private readonly CLICK_VOLUME = 0.1;
    private readonly EFFECT_VOLUME = 0.2;
    private readonly VICTORY_VOLUME = 0.6;

    // ADSR envelope settings
    private readonly ENVELOPE = {
        ATTACK: 0.01,
        DECAY: 0.03,
        SUSTAIN: 0.01,
        RELEASE: 0.01,
        LEVEL: 0.2
    };

    constructor() {}

    /**
     * Creates an ADSR buffer matching the GAS version
     * @param frequencies - Array of {time, pitch, duration} objects
     * @param volume - Volume level
     * @param length - Duration in seconds
     */
    private createNoteBuffer(frequencies: Array<{t: number, p: number, d: number}>, volume: number, length: number): AudioBuffer | null {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const samples = Math.floor(sampleRate * length);
        const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);
        const dt = 1 / sampleRate;

        // Generate each note with ADSR envelope
        const noteGenerators = frequencies.map(note => {
            const attackTime = 0.01;
            const decayTime = 0.03;
            const sustainTime = 0.03 * note.d;
            const releaseTime = 0.03 * note.d;
            const sustainLevel = 0.7;

            return {
                startTime: note.t,
                frequency: note.p,
                attackTime,
                decayTime,
                sustainTime,
                releaseTime,
                sustainLevel,
                phase: 0
            };
        });

        // Fill buffer
        for (let i = 0; i < samples; i++) {
            const time = i * dt;
            let sample = 0;

            // Sum all active notes
            for (const gen of noteGenerators) {
                if (time >= gen.startTime) {
                    const localTime = time - gen.startTime;
                    const totalTime = gen.attackTime + gen.decayTime + gen.sustainTime + gen.releaseTime;

                    if (localTime < totalTime) {
                        // Generate sine wave
                        gen.phase += (2 * Math.PI * gen.frequency) / sampleRate;
                        const sineValue = Math.sin(gen.phase);

                        // Apply ADSR envelope
                        let envelope = 0;
                        if (localTime < gen.attackTime) {
                            envelope = localTime / gen.attackTime; // Attack
                        } else if (localTime < gen.attackTime + gen.decayTime) {
                            const decayProgress = (localTime - gen.attackTime) / gen.decayTime;
                            envelope = 1 - (1 - gen.sustainLevel) * decayProgress; // Decay
                        } else if (localTime < gen.attackTime + gen.decayTime + gen.sustainTime) {
                            envelope = gen.sustainLevel; // Sustain
                        } else {
                            const releaseProgress = (localTime - gen.attackTime - gen.decayTime - gen.sustainTime) / gen.releaseTime;
                            envelope = gen.sustainLevel * (1 - releaseProgress); // Release
                        }

                        sample += sineValue * envelope;
                    }
                }
            }

            data[i] = sample * volume * this.volume;
        }

        return buffer;
    }

    /**
     * Creates a sliding pitch sound (for death sounds)
     */
    private createSlidingBuffer(startFreq: number, endFreq: number, volume: number, length: number): AudioBuffer | null {
        if (!this.audioContext) return null;

        const sampleRate = this.audioContext.sampleRate;
        const samples = Math.floor(sampleRate * length);
        const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
        const data = buffer.getChannelData(0);

        const attackTime = 0.01;
        const decayTime = 0.05;
        const sustainTime = 0.05;
        const releaseTime = 0.05;
        const sustainLevel = 0.5;
        const slideTime = 0.1;

        let phase = 0;

        for (let i = 0; i < samples; i++) {
            const time = i / sampleRate;

            // Calculate sliding frequency
            const slideProgress = Math.min(time / slideTime, 1);
            const currentFreq = startFreq + (endFreq - startFreq) * slideProgress;

            // Generate sine wave with sliding pitch
            phase += (2 * Math.PI * currentFreq) / sampleRate;
            const sineValue = Math.sin(phase);

            // Apply ADSR envelope
            let envelope = 0;
            if (time < attackTime) {
                envelope = time / attackTime;
            } else if (time < attackTime + decayTime) {
                const decayProgress = (time - attackTime) / decayTime;
                envelope = 1 - (1 - sustainLevel) * decayProgress;
            } else if (time < attackTime + decayTime + sustainTime) {
                envelope = sustainLevel;
            } else {
                const releaseProgress = (time - attackTime - decayTime - sustainTime) / releaseTime;
                envelope = sustainLevel * Math.max(0, 1 - releaseProgress);
            }

            data[i] = sineValue * envelope * volume * this.volume;
        }

        return buffer;
    }

    /**
     * Play a buffer
     */
    private playBuffer(buffer: AudioBuffer | null): void {
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
     * Basic click sound
     */
    async playClickSound(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [{t: 0, p: 110, d: 1}],
            this.CLICK_VOLUME,
            this.ENVELOPE.ATTACK + this.ENVELOPE.DECAY + this.ENVELOPE.SUSTAIN + this.ENVELOPE.RELEASE
        );
        this.playBuffer(buffer);
    }

    /**
     * Enemy dead sound - sliding pitch from 300Hz down
     */
    async playEnemyDead(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createSlidingBuffer(300, 90, this.EFFECT_VOLUME, 0.6);
        this.playBuffer(buffer);
    }

    /**
     * Our soldiers dead sound - sliding pitch from 200Hz down
     */
    async playOursDead(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createSlidingBuffer(200, 60, this.EFFECT_VOLUME, 0.6);
        this.playBuffer(buffer);
    }

    /**
     * Region takeover sound - C-E chord
     */
    async playRegionConquered(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 261, d: 1},    // C
                {t: 0.1, p: 329, d: 2}   // E
            ],
            this.EFFECT_VOLUME,
            0.2
        );
        this.playBuffer(buffer);
    }

    /**
     * Victory fanfare - chord progression
     */
    async playVictoryFanfare(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                // C major chord
                {t: 0, p: 261, d: 1},    // C
                {t: 0, p: 329, d: 2},    // E
                {t: 0, p: 392, d: 3},    // G
                // F major chord
                {t: 0.2, p: 261, d: 1},  // C
                {t: 0.2, p: 349, d: 2},  // F
                {t: 0.2, p: 440, d: 3}   // A
            ],
            this.VICTORY_VOLUME,
            0.5  // Increased to let chords fully play
        );
        this.playBuffer(buffer);
    }

    /**
     * Defeat sound - descending melody
     */
    async playDefeatSound(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 392, d: 3},      // G
                {t: 0.15, p: 329, d: 2},   // E
                {t: 0.3, p: 261, d: 1}     // C
            ],
            this.VICTORY_VOLUME,
            0.5  // Increased to let descending melody fully play
        );
        this.playBuffer(buffer);
    }

    /**
     * Almost out of time warning
     */
    async playAlmostOutOfTime(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 492, d: 1},      // B
                {t: 0.1, p: 349, d: 1}     // F
            ],
            this.EFFECT_VOLUME,
            0.25  // Increased to let both notes fully play
        );
        this.playBuffer(buffer);
    }

    /**
     * Out of time sound
     */
    async playOutOfTime(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 452, d: 2},
                {t: 0.1, p: 339, d: 2},
                {t: 0.2, p: 452, d: 2},
                {t: 0.3, p: 309, d: 2}
            ],
            this.EFFECT_VOLUME,
            0.5  // Increased to let all notes fully play
        );
        this.playBuffer(buffer);
    }

    /**
     * Game created sound - welcoming ascending notes
     */
    async playGameCreated(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 261, d: 1},      // C
                {t: 0.1, p: 329, d: 1.5},  // E
                {t: 0.2, p: 392, d: 2}     // G - welcoming major chord arpeggio
            ],
            this.EFFECT_VOLUME,
            0.4
        );
        this.playBuffer(buffer);
    }

    /**
     * Game started sound - exciting fanfare
     */
    async playGameStarted(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 392, d: 1},      // G
                {t: 0.08, p: 440, d: 1},   // A
                {t: 0.16, p: 494, d: 1.5}, // B
                {t: 0.24, p: 523, d: 2}    // C - ascending fanfare
            ],
            this.EFFECT_VOLUME,
            0.4
        );
        this.playBuffer(buffer);
    }

    /**
     * Soldiers move sound - marching rhythm
     */
    async playSoldiersMove(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 294, d: 1},      // D - first step
                {t: 0.08, p: 294, d: 1}    // D - second step (marching)
            ],
            this.EFFECT_VOLUME * 0.7,
            0.2
        );
        this.playBuffer(buffer);
    }

    /**
     * Soldiers recruited sound - military call
     */
    async playSoldiersRecruited(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 349, d: 1.5},    // F - recruitment call
                {t: 0.1, p: 392, d: 2}     // G - response
            ],
            this.EFFECT_VOLUME,
            0.3
        );
        this.playBuffer(buffer);
    }

    /**
     * Temple upgraded sound - mystical ascending tones
     */
    async playTempleUpgraded(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 440, d: 1},      // A
                {t: 0.06, p: 554, d: 1.5}, // C#
                {t: 0.12, p: 659, d: 2}    // E - mystical chord arpeggio
            ],
            this.EFFECT_VOLUME,
            0.25
        );
        this.playBuffer(buffer);
    }

    /**
     * Income sound - pleasant chime
     */
    async playIncome(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 523, d: 1},      // C5
                {t: 0.05, p: 659, d: 1.5}  // E5 - pleasant rising chime
            ],
            this.EFFECT_VOLUME,
            0.2
        );
        this.playBuffer(buffer);
    }

    /**
     * Hover sound - subtle high tone
     */
    async playHover(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [{t: 0, p: 880, d: 0.5}],  // A5 - very short, subtle
            this.CLICK_VOLUME * 0.5,
            0.03
        );
        this.playBuffer(buffer);
    }

    /**
     * Error sound - harsh low tone
     */
    async playError(): Promise<void> {
        if (!this.isEnabled) return;
        await this.initializeAudio();

        const buffer = this.createNoteBuffer(
            [
                {t: 0, p: 147, d: 2},      // D3 - low
                {t: 0.15, p: 131, d: 2}    // C3 - lower (dissonant)
            ],
            this.EFFECT_VOLUME,
            0.3
        );
        this.playBuffer(buffer);
    }

    /**
     * Play attack sequence with multiple sounds (helper method for compatibility)
     */
    async playAttackSequence(): Promise<void> {
        if (!this.isEnabled) return;

        // Play attack sound followed by combat sound
        await this.playOursDead();
        setTimeout(async () => {
            await this.playEnemyDead();
        }, GAME_CONSTANTS.QUICK_ANIMATION_MS);
    }

    /**
     * Play time warning sound (repeating) (helper method for compatibility)
     */
    async playTimeWarning(duration: number = GAME_CONSTANTS.AUDIO_WARNING_DURATION_MS): Promise<void> {
        if (!this.isEnabled) return;

        const startTime = Date.now();
        const playWarning = async () => {
            if (Date.now() - startTime < duration) {
                await this.playAlmostOutOfTime();
                setTimeout(playWarning, GAME_CONSTANTS.AUDIO_WARNING_REPEAT_MS);
            }
        };
        playWarning();
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
     * Initialize Web Audio API
     */
    private async initializeAudio(): Promise<void> {
        if (typeof window === 'undefined') {
            return;
        }

        // Don't re-initialize if already initialized
        if (this.isInitialized && this.audioContext) {
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
        console.log(`🔊 Audio toggle called - current state: ${this.isEnabled}`);
        if (this.isEnabled) {
            this.disable();
            console.log(`🔇 Audio disabled`);
        } else {
            await this.enable();
            console.log(`🔊 Audio enabled`);
        }
        console.log(`🔊 New audio state: ${this.isEnabled}`);
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
    async playSound(soundType: SoundType): Promise<void> {
        console.log(`🔊 playSound called: ${soundType}, isEnabled: ${this.isEnabled}`);
        if (!this.isEnabled) {
            console.log(`🔇 Sound ${soundType} blocked - audio disabled`);
            return;
        }

        switch (soundType) {
            // UI Sounds
            case SOUNDS.CLICK:
                return this.playClickSound();
            case SOUNDS.HOVER:
                return this.playHover();
            case SOUNDS.ERROR:
                return this.playError();

            // Game Events
            case SOUNDS.GAME_CREATED:
                return this.playGameCreated();
            case SOUNDS.GAME_STARTED:
                return this.playGameStarted();
            case SOUNDS.GAME_WON:
                return this.playVictoryFanfare();
            case SOUNDS.GAME_LOST:
                return this.playDefeatSound();

            // Player Actions
            case SOUNDS.SOLDIERS_MOVE:
                return this.playSoldiersMove();
            case SOUNDS.SOLDIERS_RECRUITED:
                return this.playSoldiersRecruited();
            case SOUNDS.TEMPLE_UPGRADED:
                return this.playTempleUpgraded();
            case SOUNDS.REGION_CONQUERED:
                return this.playRegionConquered();
            case SOUNDS.COMBAT:
                // Combat uses the enemy dead sound
                return this.playEnemyDead();
            case SOUNDS.ATTACK:
                // Attack uses our dead sound (for when we lose soldiers)
                return this.playOursDead();

            // Economy
            case SOUNDS.INCOME:
                return this.playIncome();

            // Time Warnings
            case SOUNDS.ALMOST_OUT_OF_TIME:
                return this.playAlmostOutOfTime();
            case SOUNDS.OUT_OF_TIME:
                return this.playOutOfTime();

            default:
                console.warn(`Unknown sound type: ${soundType}`);
        }
    }

}

export const audioSystem = new AudioSystem();
