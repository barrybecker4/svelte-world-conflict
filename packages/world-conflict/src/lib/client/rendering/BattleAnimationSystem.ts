import type { AttackEvent } from '$lib/game/mechanics/AttackSequenceGenerator';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS, type SoundType } from '$lib/client/audio/sounds';
import type { Region } from '$lib/game/entities/gameTypes';
import { logger } from 'multiplayer-framework/shared';

export interface FloatingTextEvent {
    regionIdx: number;
    text: string;
    color: string;
    width: number;
}

export type StateUpdateCallback = (attackerLosses: number, defenderLosses: number) => void;
export type FloatingTextCallback = (regionIdx: number, text: string, color: string) => void;

export class BattleAnimationSystem {
    private mapContainer: HTMLElement | null = null;
    private floatingTextCallback: FloatingTextCallback | null = null;

    constructor(mapContainer?: HTMLElement) {
        this.mapContainer = mapContainer ?? null;
    }

    setMapContainer(container: HTMLElement) {
        this.mapContainer = container;
    }

    setFloatingTextCallback(callback: FloatingTextCallback) {
        this.floatingTextCallback = callback;
    }

    async playAttackSequence(
        attackSequence: AttackEvent[],
        regions: Region[],
        onStateUpdate?: StateUpdateCallback
    ): Promise<void> {
        // Check if we have a map container
        if (!this.mapContainer) {
            throw new Error('No map container available, cannot show animations');
        }

        for (const event of attackSequence) {
            // Update state with casualties from this round
            if (onStateUpdate && (event.attackerCasualties || event.defenderCasualties)) {
                onStateUpdate(event.attackerCasualties || 0, event.defenderCasualties || 0);
            }

            if (event.floatingText) {
                // Show floating text if present
                for (const textEvent of event.floatingText) {
                    this.showFloatingText(textEvent, regions);
                }
            }

            if (event.soundCue) {
                // Play sound cues if present
                await this.playSoundCue(event.soundCue);
            }

            if (event.delay) {
                // Wait for delay if specified
                await this.delay(event.delay);
            }
        }
    }

    showFloatingText(textEvent: FloatingTextEvent, regions: Region[]) {
        if (this.floatingTextCallback) {
            // Use the callback if available (preferred - uses Svelte component)
            this.floatingTextCallback(textEvent.regionIdx, textEvent.text, textEvent.color);
        } else {
            // Fallback: log warning if callback not set
            logger.warn('FloatingTextCallback not set, cannot show floating text');
        }
    }

    async playSoundCue(soundCue: string): Promise<void> {
        try {
            // Map sound cues to constants (handles both new and old GAS format)
            const soundMap: Record<string, SoundType> = {
                // Actions
                attack: SOUNDS.ATTACK,
                combat: SOUNDS.COMBAT,
                move: SOUNDS.SOLDIERS_MOVE,
                conquest: SOUNDS.REGION_CONQUERED,
                recruit: SOUNDS.SOLDIERS_RECRUITED,
                soldiers: SOUNDS.SOLDIERS_RECRUITED,
                upgrade: SOUNDS.TEMPLE_UPGRADED,

                // Game events
                victory: SOUNDS.GAME_WON,
                win: SOUNDS.GAME_WON,
                defeat: SOUNDS.GAME_LOST,
                lose: SOUNDS.GAME_LOST,
                start: SOUNDS.GAME_STARTED,
                created: SOUNDS.GAME_CREATED,

                // Economy
                income: SOUNDS.INCOME,

                // UI
                click: SOUNDS.CLICK,
                hover: SOUNDS.HOVER,
                error: SOUNDS.ERROR,

                // Time warnings
                almost_out_of_time: SOUNDS.ALMOST_OUT_OF_TIME,
                out_of_time: SOUNDS.OUT_OF_TIME
            };

            const soundType = soundMap[soundCue.toLowerCase()];
            if (soundType) {
                await audioSystem.playSound(soundType);
            } else {
                logger.warn(`Unknown sound cue: ${soundCue}`);
            }
        } catch (error) {
            logger.warn(`Could not play sound cue "${soundCue}":`, error);
        }
    }

    delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cleanup() {
        // Cleanup is now handled by the FloatingTextManager component
        // No DOM elements to clean up
    }
}
