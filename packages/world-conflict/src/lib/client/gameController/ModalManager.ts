import { writable, type Writable } from 'svelte/store';
import type { Player } from '$lib/game/entities/gameTypes';

export interface ModalState {
  showSoldierSelection: boolean;
  showInstructions: boolean;
  showGameSummary: boolean;
  soldierSelectionData: { maxSoldiers: number; currentSelection: number } | null;
  winner: Player | 'DRAWN_GAME' | null;
}

/**
 * Manages all modal states for the game
 */
export class ModalManager {
  private modalState: Writable<ModalState>;

  constructor() {
    this.modalState = writable({
      showSoldierSelection: false,
      showInstructions: false,
      showGameSummary: false,
      soldierSelectionData: null,
      winner: null
    });
  }

  /**
   * Get the modal state store for component binding
   */
  getModalState(): Writable<ModalState> {
    return this.modalState;
  }

  /**
   * Show the soldier selection modal
   */
  showSoldierSelection(maxSoldiers: number, currentSelection: number): void {
    console.log('✅ Opening soldier selection modal');
    this.modalState.update(s => ({
      ...s,
      soldierSelectionData: {
        maxSoldiers,
        currentSelection
      },
      showSoldierSelection: true
    }));
  }

  /**
   * Hide the soldier selection modal
   */
  hideSoldierSelection(): void {
    this.modalState.update(s => ({
      ...s,
      showSoldierSelection: false,
      soldierSelectionData: null
    }));
  }

  /**
   * Show the game instructions modal
   */
  showInstructions(): void {
    this.modalState.update(s => ({ ...s, showInstructions: true }));
  }

  /**
   * Close the game instructions modal
   */
  closeInstructions(): void {
    this.modalState.update(s => ({ ...s, showInstructions: false }));
  }

  /**
   * Trigger game end flow with winner information
   * Shows victory banner followed by summary panel in left nav
   */
  showGameSummary(winner: Player | 'DRAWN_GAME'): void {
    this.modalState.update(s => ({
      ...s,
      winner,
      showGameSummary: true
    }));
  }
}


