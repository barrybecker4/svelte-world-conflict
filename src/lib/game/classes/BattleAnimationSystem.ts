import type { AttackEvent } from '$lib/game/classes/AttackSequenceGenerator';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';

export interface FloatingTextEvent {
  regionIdx: number;
  text: string;
  color: string;
  width: number;
}

const TEXT_CONTENT_STYLE = `
 @keyframes floatUp {
   0% {
     opacity: 1;
     transform: translate(-50%, -50%) scale(1);
   }
   50% {
     opacity: 1;
     transform: translate(-50%, -80%) scale(1.2);
   }
   100% {
     opacity: 0;
     transform: translate(-50%, -120%) scale(0.8);
   }
 }
 .floating-text {
   font-family: 'Arial', sans-serif;
   white-space: nowrap;
   font-weight: bold;
 }
`;

export class BattleAnimationSystem {
  private activeAnimations = new Set<HTMLElement>();
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
      console.warn('No map container available, cannot show animations');
      // Just log what would have been shown and play sounds
      attackSequence.forEach((event, index) => {
        if (event.floatingText) {
          console.log(`Event ${index + 1}:`, event.floatingText);
        }
        if (event.soundCue) {
          console.log(`Sound cue: ${event.soundCue}`);
        }
      });

      // Still play audio even without visuals
      for (const event of attackSequence) {
        if (event.soundCue) {
          await this.playSoundCue(event.soundCue);
        }
        if (event.delay) {
          await this.delay(event.delay);
        }
      }
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
        await this.playSoundCue(event.soundCue);
      }

      // Wait for delay if specified
      if (event.delay) {
        await this.delay(event.delay);
      }
    }
  }

  showFloatingText(textEvent: FloatingTextEvent, regions: Regions) {
    if (!this.isValid(textEvent, regions)) return;

    const region = regions.find(r => r.index === textEvent.regionIdx);
    if (!region) {
      console.warn('Region not found for floating text:', textEvent.regionIdx);
      return;
    }

    // Find the SVG element within the map container
    const screenCoords = this.getScreenCoords(region, regions);

    // Create floating text element
    const textElement = document.createElement('div');
    textElement.className = 'floating-text';
    textElement.style.cssText = `
      position: fixed;
      left: ${screenCoords.x}px;
      top: ${screenCoords.y}px;
      color: ${textEvent.color};
      font-weight: bold;
      font-size: 16px;
      pointer-events: none;
      z-index: 1000;
      animation: floatUp 3s ease-out forwards;
      transform: translate(-50%, -50%);
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
    `;
    textElement.textContent = textEvent.text;

    // Add styles if not already present
    if (!document.getElementById('floating-text-styles')) {
      const style = document.createElement('style');
      style.id = 'floating-text-styles';
      style.textContent = TEXT_CONTENT_STYLE;
      document.head.appendChild(style);
    }

    // Append to document body instead of map container for fixed positioning
    document.body.appendChild(textElement);
    this.activeAnimations.add(textElement);
    console.log('📝 Floating text element added to DOM at screen coords:', { x: screenCoords.x, y: screenCoords.y });

    // Remove after animation
    setTimeout(() => {
      if (textElement.parentNode) {
        textElement.parentNode.removeChild(textElement);
        this.activeAnimations.delete(textElement);
        console.log('🗑️ Floating text element removed');
      }
    }, 3000); // Increased to 3 seconds to match animation duration
  }

  // Calculate the actual screen position accounting for SVG scaling
  private getScreenCoords(region: Region, regions: Regions): {x: number, y: number} {
    // Get the bounding rectangle of the map container and SVG
    const containerRect = this.mapContainer.getBoundingClientRect();
    const svgElement = this.mapContainer.querySelector('svg');
    const svgRect = svgElement.getBoundingClientRect();

    const svgViewBox = svgElement.viewBox.baseVal;
    const scaleX = svgRect.width / svgViewBox.width;
    const scaleY = svgRect.height / svgViewBox.height;

    // Convert region coordinates to screen coordinates
    const screenX = svgRect.left + (region.x * scaleX);
    const screenY = svgRect.top + (region.y * scaleY);

    return { x: screenX, y: screenY };
  }

  private isValid(textEvent: FloatingTextEvent, regions: Regions) {
    if (!this.mapContainer) {
      console.warn('No map container for floating text');
      return false;
    }

    const region = regions.find(r => r.index === textEvent.regionIdx);
    if (!region) {
      console.warn('Region not found for floating text:', textEvent.regionIdx);
      return false;
    }
    return true;
  }

  async playSoundCue(soundCue: string): Promise<void> {
    console.log('Playing sound cue:', soundCue);

    try {
      // Map sound cues to our audio system
      switch (soundCue.toLowerCase()) {
        case 'attack':
        case 'combat':
        case 'battle':
          await audioSystem.playAttackSequence();
          break;
        case 'move':
          await audioSystem.playSound(SOUNDS.MOVE);
          break;
        case 'victory':
        case 'win':
          await audioSystem.playVictoryFanfare();
          break;
        case 'defeat':
        case 'lose':
          await audioSystem.playDefeatSound();
          break;
        case 'income':
          await audioSystem.playSound(SOUNDS.INCOME);
          break;
        case 'upgrade':
          await audioSystem.playSound(SOUNDS.UPGRADE);
          break;
        case 'start':
          await audioSystem.playSound(SOUNDS.START);
          break;
        default:
          // Try to play as a standard sound type
          await audioSystem.playSound(soundCue as any);
          break;
      }
    } catch (error) {
      console.warn(`Could not play sound cue "${soundCue}":`, error);
    }
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
