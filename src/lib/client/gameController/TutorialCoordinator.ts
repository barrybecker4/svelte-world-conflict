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
    console.log('📖 TutorialCoordinator.updateTooltips called', {
      hasGameState: !!gameState,
      hasRegions: !!regions,
      regionsCount: regions?.length,
      moveState
    });

    if (!gameState || !regions) {
      console.log('📖 No game state or regions, clearing tooltips');
      // Mark any currently visible tooltips as shown before clearing
      const currentTooltips = get(this.tutorialTips);
      currentTooltips.forEach(tooltip => {
        this.tutorialManager.markTooltipAsShown(tooltip.id);
      });
      this.tutorialTips.set([]);
      return;
    }

    const isMyTurn = gameState.currentPlayerSlot === this.playerSlotIndex;
    const selectedRegionIndex = moveState?.sourceRegion ?? null;

    console.log('📖 TutorialCoordinator tooltip params:', {
      playerSlotIndex: this.playerSlotIndex,
      currentPlayerSlot: gameState.currentPlayerSlot,
      isMyTurn,
      selectedRegionIndex,
      mode: moveState?.mode
    });

    // Get previous tooltips to detect what's being removed
    const previousTooltips = get(this.tutorialTips);

    const tooltips = this.tutorialManager.getTooltips(
      gameState,
      regions,
      selectedRegionIndex,
      isMyTurn
    );

    // Mark any tooltips that were visible but are now gone as "shown"
    previousTooltips.forEach(prevTooltip => {
      const stillVisible = tooltips.some(t => t.id === prevTooltip.id);
      if (!stillVisible) {
        console.log('📖 Marking tooltip as shown (no longer visible):', prevTooltip.id);
        this.tutorialManager.markTooltipAsShown(prevTooltip.id);
      }
    });

    console.log('📖 TutorialCoordinator setting tooltips:', tooltips);
    this.tutorialTips.set(tooltips);
  }

  /**
   * Dismiss a tutorial tooltip
   */
  dismissTooltip(tooltipId: string): void {
    this.tutorialManager.dismissTooltip(tooltipId);
    // Note: Caller should call updateTooltips() after this
  }
}

