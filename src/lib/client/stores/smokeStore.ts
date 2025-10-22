/**
 * Global store for managing smoke particles across all regions
 */
import { writable } from 'svelte/store';

export interface SmokeParticle {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

function createSmokeStore() {
  const { subscribe, set, update } = writable<SmokeParticle[]>([]);

  let nextId = 0;

  return {
    subscribe,
    
    /**
     * Spawn smoke particles at a location
     */
    spawnAt(x: number, y: number, numParticles: number = 20, duration: number = 3050): void {
      const newParticles: SmokeParticle[] = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2; // Full circle in radians (0 to 2π)
        const dist = (Math.random() * 200) / 80; // Distance from 0 to 2.5 units
        const particleX = x + Math.sin(angle) * dist;
        const particleY = y + Math.cos(angle) * dist;
        
        const particle: SmokeParticle = {
          id: nextId++,
          x: particleX,
          y: particleY,
          timestamp
        };
        
        newParticles.push(particle);
        
        // Schedule removal
        setTimeout(() => {
          update(particles => particles.filter(p => p.id !== particle.id));
        }, duration);
      }
      
      update(particles => [...particles, ...newParticles]);
      console.log(`💨 Smoke store: Added ${numParticles} particles at (${x}, ${y}), total now: ${newParticles.length}`);
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

