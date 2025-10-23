import { writable, type Writable } from 'svelte/store';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import { ModalManager } from './ModalManager';

/**
 * Coordinates move-related UI state and interactions
 * Extracted from GameController to isolate move UI logic
 */
export class MoveUICoordinator {
  private moveState: Writable<MoveState>;
  private modalManager: ModalManager;
  private gameStore: any;

  constructor(gameStore: any, modalManager: ModalManager) {
    this.gameStore = gameStore;
    this.modalManager = modalManager;

    // Initialize move state store
    this.moveState = writable({
      mode: 'IDLE',
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves: 3,
      isMoving: false
    });
  }

  /**
   * Get the move state store for component binding
   */
  getMoveStateStore(): Writable<MoveState> {
    return this.moveState;
  }

  /**
   * Handle move state changes
   * Manages soldier selection modal display based on move state
   */
  handleMoveStateChange(newState: MoveState, onTooltipUpdate: () => void): void {
    console.log('🔄 MoveUICoordinator.handleMoveStateChange:', newState);
    this.moveState.set(newState);

    // Show soldier selection modal when needed (after both source and target are selected)
    // But don't show it if we're already executing a move
    const shouldShowModal = newState.mode === 'ADJUST_SOLDIERS'
      && newState.sourceRegion !== null
      && newState.targetRegion !== null
      && !newState.isMoving;

    console.log('🔄 Modal decision:', {
      mode: newState.mode,
      hasSource: newState.sourceRegion !== null,
      hasTarget: newState.targetRegion !== null,
      isMoving: newState.isMoving,
      shouldShowModal
    });

    if (shouldShowModal) {
      this.modalManager.showSoldierSelection(newState.maxSoldiers, newState.selectedSoldierCount);
    } else {
      this.modalManager.hideSoldierSelection();
    }

    // Update tutorial tooltips
    onTooltipUpdate();
  }

  /**
   * Handle soldier count change (for real-time updates in modal)
   */
  handleSoldierCountChange(count: number): void {
    this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));
  }

  /**
   * Confirm soldier selection and execute the move
   */
  confirmSoldierSelection(count: number): void {
    // Update the move state with the selected count
    this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));

    // Close the modal
    this.modalManager.hideSoldierSelection();

    // Execute the move with the selected count
    const moveSystem = this.gameStore.getMoveSystem();
    moveSystem?.processAction({
      type: 'ADJUST_SOLDIERS',
      payload: { soldierCount: count }
    });
  }

  /**
   * Cancel soldier selection
   */
  cancelSoldierSelection(): void {
    this.modalManager.hideSoldierSelection();

    const moveSystem = this.gameStore.getMoveSystem();
    moveSystem?.processAction({ type: 'CANCEL' });
  }

  /**
   * Close temple upgrade panel and return to normal mode
   */
  closeTempleUpgradePanel(): void {
    console.log('🏛️ MoveUICoordinator.closeTempleUpgradePanel');
    const moveSystem = this.gameStore.getMoveSystem();
    moveSystem?.processAction({ type: 'CANCEL' });
  }

  /**
   * Handle region click from map
   */
  handleRegionClick(region: any, isMyTurn: boolean): void {
    console.log('🖱️ MoveUICoordinator.handleRegionClick:', {
      regionIndex: region.index,
      isMyTurn,
      moveSystemExists: !!this.gameStore.getMoveSystem()
    });

    if (!isMyTurn) {
      console.log('❌ Not my turn, ignoring click');
      return;
    }

    const moveSystem = this.gameStore.getMoveSystem();
    if (!moveSystem) {
      console.error('❌ Move system not initialized!');
      return;
    }

    console.log('✅ Delegating to move system...');
    moveSystem.handleRegionClick(region.index);
  }

  /**
   * Handle temple click from map
   */
  handleTempleClick(regionIndex: number, isMyTurn: boolean): void {
    console.log('🏛️ MoveUICoordinator.handleTempleClick:', {
      regionIndex,
      isMyTurn,
      moveSystemExists: !!this.gameStore.getMoveSystem()
    });

    if (!isMyTurn) {
      console.log('❌ Not my turn, ignoring temple click');
      return;
    }

    const moveSystem = this.gameStore.getMoveSystem();
    if (!moveSystem) {
      console.error('❌ Move system not initialized!');
      return;
    }

    console.log('✅ Delegating temple click to move system...');
    moveSystem.handleTempleClick(regionIndex);
  }

  /**
   * Reset move state (e.g., after ending turn or undoing)
   */
  resetMoveState(availableMoves: number = 3): void {
    this.moveState.set({
      mode: 'IDLE',
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves,
      isMoving: false
    });
  }
}
