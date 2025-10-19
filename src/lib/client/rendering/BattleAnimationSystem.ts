import type { AttackEvent } from '$lib/game/mechanics/AttackSequenceGenerator';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS, type SoundType } from '$lib/client/audio/sounds';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { Region } from '$lib/game/entities/gameTypes';

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

export type StateUpdateCallback = (attackerLosses: number, defenderLosses: number) => void;

export class BattleAnimationSystem {
  private activeAnimations = new Set<HTMLElement>();
  private mapContainer: HTMLElement | null = null;

  constructor(mapContainer?: HTMLElement) {
    this.mapContainer = mapContainer ?? null;
  }

  setMapContainer(container: HTMLElement) {
    this.mapContainer = container;
    console.log('🗺️ BattleAnimationSystem: Map container set:', container);
  }

  async playAttackSequence(
    attackSequence: AttackEvent[],
    regions: any[],
    onStateUpdate?: StateUpdateCallback
  ): Promise<void> {
    console.log('Playing attack sequence:', attackSequence);

    // Check if we have a map container
    if (!this.mapContainer) {
      throw new Error('No map container available, cannot show animations');
    }

    for (const event of attackSequence) {
      // Update state with casualties from this round
      if (onStateUpdate && (event.attackerCasualties || event.defenderCasualties)) {
        onStateUpdate(event.attackerCasualties || 0, event.defenderCasualties || 0);
      }

      if (event.floatingText) {   // Show floating text if present
        for (const textEvent of event.floatingText) {
          this.showFloatingText(textEvent, regions);
        }
      }

      if (event.soundCue) { // Play sound cues if present
        await this.playSoundCue(event.soundCue);
      }

      if (event.delay) { // Wait for delay if specified
        await this.delay(event.delay);
      }
    }
  }

  showFloatingText(textEvent: FloatingTextEvent, regions: Region[]) {
    if (!this.isValid(textEvent, regions)) return;

    const region = regions.find((r: Region) => r.index === textEvent.regionIdx);
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
    console.log('Floating text element added to DOM at screen coords:', { x: screenCoords.x, y: screenCoords.y });

    // Remove after animation
    setTimeout(() => {
      if (textElement.parentNode) {
        textElement.parentNode.removeChild(textElement);
        this.activeAnimations.delete(textElement);
        console.log('🗑Floating text element removed');
      }
    }, GAME_CONSTANTS.BANNER_TIME);
  }

  // Calculate the actual screen position accounting for SVG scaling
  private getScreenCoords(region: Region, regions: Region[]): {x: number, y: number} {
    // Get the bounding rectangle of the map container and SVG
    if (!this.mapContainer) throw new Error('Map container not set');
    const containerRect = this.mapContainer.getBoundingClientRect();
    const svgElement = this.mapContainer.querySelector('svg');
    if (!svgElement) throw new Error('SVG element not found');
    const svgRect = svgElement.getBoundingClientRect();

    const svgViewBox = svgElement.viewBox.baseVal;
    const scaleX = svgRect.width / svgViewBox.width;
    const scaleY = svgRect.height / svgViewBox.height;

    // Convert region coordinates to screen coordinates
    const screenX = svgRect.left + (region.x * scaleX);
    const screenY = svgRect.top + (region.y * scaleY);

    return { x: screenX, y: screenY };
  }

  private isValid(textEvent: FloatingTextEvent, regions: Region[]) {
    if (!this.mapContainer) {
      console.warn('No map container for floating text');
      return false;
    }

    const region = regions.find((r: Region) => r.index === textEvent.regionIdx);
    if (!region) {
      console.warn('Region not found for floating text:', textEvent.regionIdx);
      return false;
    }
    return true;
  }

  async playSoundCue(soundCue: string): Promise<void> {
      console.log('Playing sound cue:', soundCue);

      try {
          // Map sound cues to constants (handles both new and old GAS format)
          const soundMap: Record<string, SoundType> = {
              // Actions
              'attack': SOUNDS.ATTACK,
              'combat': SOUNDS.COMBAT,
              'move': SOUNDS.SOLDIERS_MOVE,
              'conquest': SOUNDS.REGION_CONQUERED,
              'recruit': SOUNDS.SOLDIERS_RECRUITED,
              'soldiers': SOUNDS.SOLDIERS_RECRUITED,
              'upgrade': SOUNDS.TEMPLE_UPGRADED,

              // Game events
              'victory': SOUNDS.GAME_WON,
              'win': SOUNDS.GAME_WON,
              'defeat': SOUNDS.GAME_LOST,
              'lose': SOUNDS.GAME_LOST,
              'start': SOUNDS.GAME_STARTED,
              'created': SOUNDS.GAME_CREATED,

              // Economy
              'income': SOUNDS.INCOME,

              // UI
              'click': SOUNDS.CLICK,
              'hover': SOUNDS.HOVER,
              'error': SOUNDS.ERROR,

              // Time warnings
              'almost_out_of_time': SOUNDS.ALMOST_OUT_OF_TIME,
              'out_of_time': SOUNDS.OUT_OF_TIME,
          };

          const soundType = soundMap[soundCue.toLowerCase()];
          if (soundType) {
              await audioSystem.playSound(soundType);
          } else {
              console.warn(`Unknown sound cue: ${soundCue}`);
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
