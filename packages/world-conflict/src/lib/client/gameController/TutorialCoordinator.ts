import { writable, get, type Writable } from 'svelte/store';
import { TutorialTips, type TooltipData } from '$lib/client/feedback/TutorialTips';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import type { MoveState } from '$lib/game/mechanics/moveTypes';

/**
 * Coordinates tutorial tooltip display and management
 * Extracted from GameController to isolate tutorial-specific logic
 */
export class TutorialCoordinator {
  private tutorialTips: Writable<TooltipData[]>;
  private tutorialManager: TutorialTips;
  private playerSlotIndex: number;

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

    if (this.clearTooltipsIfInvalid(gameState, regions)) {
      return;
    }

    if (!gameState) return;

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
   * Clear tooltips if game state or regions are invalid
   * Returns true if tooltips were cleared, false otherwise
   */
  private clearTooltipsIfInvalid(
    gameState: GameStateData | null,
    regions: any[]
  ): boolean {
    if (!gameState || !regions) {
      console.log('📖 No game state or regions, clearing tooltips');
      // Mark any currently visible tooltips as shown before clearing
      const currentTooltips = get(this.tutorialTips);
      currentTooltips.forEach(tooltip => {
        this.tutorialManager.markTooltipAsShown(tooltip.id);
      });
      this.tutorialTips.set([]);
      return true;
    }
    return false;
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
        console.log('📖 Marking tooltip as shown (no longer visible):', prevTooltip.id);
        this.tutorialManager.markTooltipAsShown(prevTooltip.id);
      }
    });
  }

  /**
   * Dismiss a tutorial tooltip
   */
  dismissTooltip(tooltipId: string): void {
    this.tutorialManager.dismissTooltip(tooltipId);
    // Note: Caller should call updateTooltips() after this
  }
}

