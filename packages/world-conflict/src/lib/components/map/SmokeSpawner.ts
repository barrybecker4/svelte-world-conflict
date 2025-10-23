/**
 * SmokeSpawner - Manages smoke particle effects for battle casualties
 * 
 * Handles spawning, tracking, and cleanup of smoke particles that appear
 * when soldiers are eliminated during battle animations.
 */

export interface SmokeParticle {
  id: number;
  x: number;
  y: number;
}

export class SmokeSpawner {
  private particles: SmokeParticle[] = [];
  private nextId: number = 0;
  private updateCallback: ((particles: SmokeParticle[]) => void) | null = null;

  /**
   * Set a callback that will be invoked whenever the particle list changes
   */
  setUpdateCallback(callback: (particles: SmokeParticle[]) => void): void {
    this.updateCallback = callback;
  }

  /**
   * Get the current list of smoke particles
   */
  getParticles(): SmokeParticle[] {
    return this.particles;
  }

  /**
   * Spawn a cloud of smoke particles at the specified location
   * @param x - X coordinate for smoke spawn
   * @param y - Y coordinate for smoke spawn
   * @param numParticles - Number of particles to spawn (default: 20)
   * @param duration - How long particles should last in ms (default: 3050)
   */
  spawnAt(x: number, y: number, numParticles: number = 20, duration: number = 3050): void {
    // Spawn multiple smoke particles in a small cloud pattern
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2; // Full circle in radians (0 to 2π)
      const dist = (Math.random() * 200) / 80; // Distance from 0 to 2.5 units
      const particleX = x + Math.sin(angle) * dist;
      const particleY = y + Math.cos(angle) * dist;
      
      const smokeId = this.nextId++;
      this.particles = [...this.particles, {
        id: smokeId,
        x: particleX,
        y: particleY
      }];

      // Remove smoke particle after animation completes
      setTimeout(() => {
        this.removeParticle(smokeId);
      }, duration);
    }
    
    // Notify subscribers of the change
    this.notifyUpdate();
  }

  /**
   * Remove a specific particle by ID
   */
  private removeParticle(id: number): void {
    this.particles = this.particles.filter(p => p.id !== id);
    this.notifyUpdate();
  }

  /**
   * Clear all smoke particles
   */
  clearAll(): void {
    this.particles = [];
    this.notifyUpdate();
  }

  /**
   * Notify the update callback if one is registered
   */
  private notifyUpdate(): void {
    if (this.updateCallback) {
      this.updateCallback(this.particles);
    }
  }

  /**
   * Get the total number of active particles
   */
  getParticleCount(): number {
    return this.particles.length;
  }
}

