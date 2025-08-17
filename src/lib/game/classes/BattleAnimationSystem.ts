import type { AttackEvent } from '$lib/game/classes/AttackSequenceGenerator';

export interface FloatingTextEvent {
  regionIdx: number;
  text: string;
  color: string;
  width: number;
}


export class BattleAnimationSystem {
  private activeAnimations = new Map<string, HTMLElement>();
  private mapContainer: HTMLElement | null = null;

  constructor(mapContainer?: HTMLElement) {
    this.mapContainer = mapContainer;
  }

  setMapContainer(container: HTMLElement) {
    this.mapContainer = container;
    console.log('🗺️ BattleAnimationSystem: Map container set:', container);
  }

  async playAttackSequence(attackSequence: AttackEvent[], regions: any[]): Promise<void> {
    console.log('🎬 Playing attack sequence:', attackSequence);

    // Check if we have a map container
    if (!this.mapContainer) {
      console.warn('⚠️ No map container available, cannot show animations');
      // Just log what would have been shown
      attackSequence.forEach((event, index) => {
        if (event.floatingText) {
          console.log(`Event ${index + 1}:`, event.floatingText);
        }
      });
      return;
    }

    for (const event of attackSequence) {
      // Play floating text if present
      if (event.floatingText) {
        for (const textEvent of event.floatingText) {
          this.showFloatingText(textEvent, regions);
        }
      }

      // Play sound cues if present
      if (event.soundCue) {
        this.playSoundCue(event.soundCue);
      }

      // Wait for delay if specified
      if (event.delay) {
        await this.delay(event.delay);
      }
    }
  }

  showFloatingText(textEvent: FloatingTextEvent, regions: any[]) {
    if (!this.mapContainer) {
      console.warn('No map container for floating text');
      return;
    }

    const region = regions.find(r => r.index === textEvent.regionIdx);
    if (!region) {
      console.warn('Region not found for floating text:', textEvent.regionIdx);
      return;
    }

    console.log('🎨 Creating floating text:', textEvent.text, 'at region', textEvent.regionIdx);

    // Get the map container's bounding rect for proper positioning
    const mapRect = this.mapContainer.getBoundingClientRect();
    const mapSvg = this.mapContainer.querySelector('svg');

    if (!mapSvg) {
      console.warn('No SVG found in map container');
      return;
    }

    // Create floating text element
    const textElement = document.createElement('div');
    textElement.className = 'floating-text';
    textElement.textContent = textEvent.text;

    // Calculate position relative to the map container
    // Note: region.x and region.y are SVG coordinates, we need to scale them
    const svgRect = mapSvg.getBoundingClientRect();
    const scaleX = svgRect.width / mapSvg.viewBox.baseVal.width;
    const scaleY = svgRect.height / mapSvg.viewBox.baseVal.height;

    const screenX = region.x * scaleX;
    const screenY = region.y * scaleY;

    textElement.style.cssText = `
      position: absolute;
      left: ${screenX}px;
      top: ${screenY}px;
      color: ${textEvent.color};
      font-weight: bold;
      font-size: ${Math.max(12, (textEvent.width || 4) * 3)}px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 1000;
      transform: translate(-50%, -50%);
      animation: floatUp 2s ease-out forwards;
    `;

    // Add CSS animation if not already present
    if (!document.getElementById('floating-text-styles')) {
      const style = document.createElement('style');
      style.id = 'floating-text-styles';
      style.textContent = `
        @keyframes floatUp {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -70%) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -100%) scale(0.8);
          }
        }
        .floating-text {
          font-family: 'Arial', sans-serif;
          white-space: nowrap;
        }
      `;
      document.head.appendChild(style);
    }

    this.mapContainer.appendChild(textElement);
    console.log('✨ Floating text element added to DOM');

    // Remove after animation
    setTimeout(() => {
      if (textElement.parentNode) {
        textElement.parentNode.removeChild(textElement);
        console.log('🗑️ Floating text element removed');
      }
    }, 2000);
  }

  playSoundCue(soundCue: string) {
    // For now, just log the sound cue
    // You can implement actual sound playback here
    console.log('🔊 Sound cue:', soundCue);
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanup() {
    // Clear any active animations
    this.activeAnimations.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.activeAnimations.clear();
  }
}
