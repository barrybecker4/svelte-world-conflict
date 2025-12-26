import type { GameStateData, Region } from '$lib/game/entities/gameTypes';
import { hasInstructionBeenShown, markInstructionAsShown } from '$lib/client/stores/clientStorage';

export interface TooltipData {
  id: string;
  x: number;
  y: number;
  text: string;
  width?: number;
}
const TIP_WIDTH = 14;

// Instruction keys for tracking (use simple keys, not the full text)
const INSTRUCTION_KEYS = {
  MOVE_REGION: 'tip_move_region',
  MOVE_TO_NEIGHBOR: 'tip_move_to_neighbor',
  CONQUEST_NO_MOVE: 'tip_conquest_no_move',
  END_TURN: 'tip_end_turn',
  UI_BUTTONS: 'tip_ui_buttons'
} as const;

// Instruction text to display
const INSTRUCTIONS = {
  MOVE_REGION: 'Click a target region and select the number of soldiers to move.',
  MOVE_TO_NEIGHBOR: 'Click a bordering region to move to.',
  CONQUEST_NO_MOVE: 'Armies that conquer a new region cannot move again.',
  END_TURN: "Once you're done, click 'End turn' here.",
  UI_BUTTONS: 'If you want to undo a move or check the rules, use the buttons here.'
} as const;

/**
 * Manages contextual tutorial tooltips during gameplay
 */
export class TutorialTips {
  private dismissedTooltips: Set<string> = new Set();

  /**
   * Check if a tooltip should be shown (not already shown or dismissed)
   */
  private shouldShowTooltip(key: string): boolean {
    return !hasInstructionBeenShown(key) && !this.dismissedTooltips.has(key);
  }

  /**
   * Get tooltips to display based on current game state
   */
  getTooltips(
    gameState: GameStateData | null,
    regions: Region[],
    selectedRegionIndex: number | null,
    isMyTurn: boolean
  ): TooltipData[] {
    if (!gameState || !isMyTurn || !regions || regions.length === 0) {
      return [];
    }

    const tooltips: TooltipData[] = [];

    // Only show tips for human players on their turn
    const currentPlayer = gameState.players?.find(p => p.slotIndex === gameState.currentPlayerSlot);
    if (!currentPlayer || currentPlayer.isAI) {
      return [];
    }

    // Show tips based on selected region
    if (selectedRegionIndex !== null) {
      const selectedRegion = regions.find(r => r.index === selectedRegionIndex);
      // Only add move tips if we found the region
      if (selectedRegion) {
        this.addMoveTips(tooltips, selectedRegion, regions);
      }
    } else {
      // Show tips for conquered regions
      this.addConquestTips(tooltips, gameState, regions);
    }

    // Show UI button tip in early game
    if (gameState.turnNumber === 2 && gameState.movesRemaining === 2) {
      this.addUIButtonTip(tooltips);
    }

    return tooltips;
  }

  /**
   * Add tips for moving armies
   */
  private addMoveTips(tooltips: TooltipData[], selectedRegion: Region, regions: Region[]): void {
    // Tip 1: Click region again to change soldier count
    if (this.shouldShowTooltip(INSTRUCTION_KEYS.MOVE_REGION)) {
      tooltips.push({
        id: INSTRUCTION_KEYS.MOVE_REGION,
        x: this.svgToPercentX(selectedRegion.x),
        y: this.svgToPercentY(selectedRegion.y),
        text: INSTRUCTIONS.MOVE_REGION,
        width: TIP_WIDTH
      });
    }

    // Tip 2: Click a neighboring region to move
    if (this.shouldShowTooltip(INSTRUCTION_KEYS.MOVE_TO_NEIGHBOR) && selectedRegion.neighbors.length > 0) {
      // Find the furthest neighbor for better visibility
      let furthestNeighbor: Region | null = null;
      let maxDistance = 0;

      for (const neighborIdx of selectedRegion.neighbors) {
        const neighbor = regions.find(r => r.index === neighborIdx);
        if (neighbor) {
          // Calculate distance manually (regions might be plain objects from WebSocket)
          const dx = selectedRegion.x - neighbor.x;
          const dy = selectedRegion.y - neighbor.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > maxDistance) {
            maxDistance = distance;
            furthestNeighbor = neighbor;
          }
        }
      }

      if (furthestNeighbor) {
        tooltips.push({
          id: INSTRUCTION_KEYS.MOVE_TO_NEIGHBOR,
          x: this.svgToPercentX(furthestNeighbor.x),
          y: this.svgToPercentY(furthestNeighbor.y),
          text: INSTRUCTIONS.MOVE_TO_NEIGHBOR,
          width: TIP_WIDTH
        });
      }
    }
  }

  /**
   * Add tips about conquered regions
   */
  private addConquestTips(tooltips: TooltipData[], gameState: GameStateData, regions: Region[]): void {
    const conqueredRegions = gameState.conqueredRegions || [];

    if (conqueredRegions.length > 0) {
      // Show tip on the most recently conquered region
      const mostRecentRegionIdx = conqueredRegions[conqueredRegions.length - 1];
      const region = regions.find(r => r.index === mostRecentRegionIdx);

      if (region && this.shouldShowTooltip(INSTRUCTION_KEYS.CONQUEST_NO_MOVE)) {
        tooltips.push({
          id: INSTRUCTION_KEYS.CONQUEST_NO_MOVE,
          x: this.svgToPercentX(region.x),
          y: this.svgToPercentY(region.y),
          text: INSTRUCTIONS.CONQUEST_NO_MOVE,
          width: TIP_WIDTH
        });
      }
    }
  }

  /**
   * Add tip about UI buttons
   * Note: Currently a no-op as UI button tips need different positioning logic
   */
  private addUIButtonTip(_tooltips: TooltipData[]): void {
    // UI button tips would point to elements outside the map
    // This requires a different positioning approach - skipped for now
  }

  /**
   * Dismiss a tooltip (prevents it from showing again this session and permanently)
   */
  dismissTooltip(tooltipId: string): void {
    this.markTooltipAsShown(tooltipId);
  }

  /**
   * Mark a tooltip as shown (saves to localStorage)
   */
  markTooltipAsShown(tooltipId: string): void {
    this.dismissedTooltips.add(tooltipId);
    markInstructionAsShown(tooltipId);
  }

  /**
   * Clear all tutorial progress (for testing)
   */
  static resetAllTutorials(): void {
    localStorage.removeItem('wc_first_time_instructions');
  }

  /**
   * Convert SVG x coordinate (0-800) to percentage (0-100)
   */
  private svgToPercentX(x: number): number {
    return (x / 800) * 100;
  }

  /**
   * Convert SVG y coordinate (0-600) to percentage (0-100)
   */
  private svgToPercentY(y: number): number {
    return (y / 600) * 100;
  }
}
