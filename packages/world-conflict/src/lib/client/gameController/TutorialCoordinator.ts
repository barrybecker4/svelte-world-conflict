import { writable, get, type Writable } from 'svelte/store';
import { TutorialTips, type TooltipData } from '$lib/client/feedback/TutorialTips';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import type { MoveState } from '$lib/game/mechanics/moveTypes';

/**
 * Coordinates tutorial tooltip display and management
 */
export class TutorialCoordinator {
  private tutorialTips: Writable<TooltipData[]>;
  private tutorialManager: TutorialTips;
  private readonly playerSlotIndex: number;

  constructor(playerId: string) {
    this.playerSlotIndex = parseInt(playerId);
    this.tutorialTips = writable([]);
    this.tutorialManager = new TutorialTips();
  }

  /**
   * Get the tutorial tips store for component binding
   */
  getTutorialTipsStore(): Writable<TooltipData[]> {
    return this.tutorialTips;
  }

  /**
   * Update tutorial tooltips based on current game state
   */
  updateTooltips(
    gameState: GameStateData | null,
    regions: any[],
    moveState: MoveState
  ): void {
    if (!gameState || !regions) {
      this.clearTooltips();
      return;
    }

    const isMyTurn = gameState.currentPlayerSlot === this.playerSlotIndex;
    const selectedRegionIndex = moveState?.sourceRegion ?? null;

    const previousTooltips = get(this.tutorialTips);
    const tooltips = this.tutorialManager.getTooltips(
      gameState,
      regions,
      selectedRegionIndex,
      isMyTurn
    );

    this.markRemovedTooltipsAsShown(previousTooltips, tooltips);
    this.tutorialTips.set(tooltips);
  }

  /**
   * Clear all tooltips
   */
  private clearTooltips(): void {
    const currentTooltips = get(this.tutorialTips);
    currentTooltips.forEach(tooltip => {
      this.tutorialManager.markTooltipAsShown(tooltip.id);
    });
    this.tutorialTips.set([]);
  }

  /**
   * Mark tooltips that are no longer visible as shown
   */
  private markRemovedTooltipsAsShown(
    previousTooltips: TooltipData[],
    currentTooltips: TooltipData[]
  ): void {
    previousTooltips.forEach(prevTooltip => {
      const stillVisible = currentTooltips.some(t => t.id === prevTooltip.id);
      if (!stillVisible) {
        this.tutorialManager.markTooltipAsShown(prevTooltip.id);
      }
    });
  }

  /**
   * Dismiss a tutorial tooltip
   */
  dismissTooltip(tooltipId: string): void {
    this.tutorialManager.dismissTooltip(tooltipId);
  }
}
