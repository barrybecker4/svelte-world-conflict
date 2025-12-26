/**
 * Global store for managing smoke particles across all regions
 */
import { writable } from 'svelte/store';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

export interface SmokeParticle {
    id: number;
    x: number;
    y: number;
    timestamp: number;
    // Pre-computed random offsets for smooth animation
    driftX: number; // Horizontal drift offset
    driftY: number; // Vertical drift offset
}

function createSmokeStore() {
    const { subscribe, set, update } = writable<SmokeParticle[]>([]);

    let nextId = 0;

    return {
        subscribe,

        /**
         * Spawn smoke particles at a location
         */
        spawnAt(
            x: number,
            y: number,
            numParticles: number = GAME_CONSTANTS.SMOKE_PARTICLE_COUNT,
            duration: number = GAME_CONSTANTS.SMOKE_DURATION_MS
        ): void {
            const newParticles: SmokeParticle[] = [];
            const timestamp = Date.now();

            for (let i = 0; i < numParticles; i++) {
                const angle = Math.random() * Math.PI * 2; // Full circle in radians (0 to 2π)
                const dist = (Math.random() * Math.random() * 1100) / 80;
                const particleX = x + Math.sin(angle) * dist;
                const particleY = y + Math.cos(angle) * dist;

                const particle: SmokeParticle = {
                    id: nextId++,
                    x: particleX,
                    y: particleY,
                    timestamp,
                    // Pre-compute random offsets for smooth animation
                    driftX: Math.random() * 20, // Horizontal drift (0-20 pixels)
                    driftY: Math.random() // Vertical wobble (0-1 pixels)
                };

                newParticles.push(particle);

                // Schedule removal
                setTimeout(() => {
                    update(particles => particles.filter(p => p.id !== particle.id));
                }, duration);
            }

            update(particles => [...particles, ...newParticles]);
        },

        /**
         * Clear all smoke particles
         */
        clear(): void {
            set([]);
        }
    };
}

export const smokeStore = createSmokeStore();
