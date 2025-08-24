import type { MoveState, MoveAction } from '../types/MoveTypes';

export class MoveSystem {
  private state: MoveState;
  private gameState: any;
  private onMoveComplete?: (from: number, to: number, soldiers: number) => Promise<void>;
  private onStateChange?: (state: MoveState) => void;

  constructor(
    gameState: any,
    onMoveComplete?: (from: number, to: number, soldiers: number) => Promise<void>,
    onStateChange?: (state: MoveState) => void
  ) {
    this.gameState = gameState;
    this.onMoveComplete = onMoveComplete;
    this.onStateChange = onStateChange;

    this.state = {
      mode: 'IDLE',
      sourceRegion: null,
      targetRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves: gameState?.movesRemaining ?? 3,
      isMoving: false
    };
  }

  getState(): MoveState {
    return { ...this.state };
  }

  /**
   * Cancel the current move operation and reset to idle state
   */
  cancelMove(): void {
    console.log('🚫 Cancelling current move operation');
    this.processAction({ type: 'CANCEL' });
  }

  /**
   * Public method to reset the move system completely
   * Similar to cancelMove but more explicit about full reset
   */
  public reset(): void {
    console.log('🔄 Resetting move system to initial state');
    this.processAction({ type: 'RESET' });
  }

  async processAction(action: MoveAction): Promise<void> {
    const prevState = { ...this.state };

    switch (action.type) {
      case 'RESET':
        this.state = {
          mode: 'IDLE',
          sourceRegion: null,
          targetRegion: null,
          selectedSoldierCount: 0,
          maxSoldiers: 0,
          availableMoves: this.gameState?.movesRemaining ?? 3,
          isMoving: false
        };
        break;

      case 'SELECT_SOURCE':
        await this.handleSourceSelection(action.payload?.regionIndex);
        break;

      case 'ADJUST_SOLDIERS':
        this.handleSoldierAdjustment(action.payload?.soldierCount);
        break;

      case 'SELECT_TARGET':
        await this.handleTargetSelection(action.payload?.regionIndex);
        break;

      case 'CANCEL':
        this.handleCancel();
        break;

      case 'CONFIRM_MOVE':
        await this.handleConfirmMove();
        break;

      case 'ENTER_BUILD_MODE':
        this.state.mode = 'BUILD';
        this.state.isMoving = false;
        break;
    }

    // Notify of state change if it actually changed
    if (JSON.stringify(prevState) !== JSON.stringify(this.state) && this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  // Handle region clicks during gameplay
  async handleRegionClick(regionIndex: number): Promise<void> {
    switch (this.state.mode) {
      case 'IDLE':
      case 'SELECT_SOURCE':
        await this.processAction({
          type: 'SELECT_SOURCE',
          payload: { regionIndex }
        });
        break;

      case 'ADJUST_SOLDIERS':
        // Clicking the same region opens soldier adjustment
        if (regionIndex === this.state.sourceRegion) {
          // Trigger soldier selection modal - this should be handled by the UI
          this.notifyNeedsSoldierSelection();
        } else {
          // Clicking different region = set target and wait for soldier confirmation
          await this.processAction({
            type: 'SELECT_TARGET',
            payload: { regionIndex }
          });
        }
        break;

      case 'SELECT_TARGET':
        // In this mode, we're waiting for target selection
        await this.processAction({
          type: 'SELECT_TARGET',
          payload: { regionIndex }
        });
        break;
    }
  }

  private async handleSourceSelection(regionIndex?: number): Promise<void> {
    if (regionIndex === undefined) return;

    // Validate that player owns this region
    if (!this.isPlayerRegion(regionIndex)) {
      console.warn('Cannot select region not owned by player');
      return;
    }

    // Validate that region has armies to move
    const soldierCount = this.getSoldierCountAtRegion(regionIndex);
    if (!soldierCount) {
      console.warn('Region must have more than 1 army to move');
      return;
    }

    // Check if this region has already moved this turn
    if (this.hasRegionMovedThisTurn(regionIndex)) {
      console.warn('This region has already moved this turn');
      return;
    }

    this.state.sourceRegion = regionIndex;
    this.state.maxSoldiers = Math.max(1, soldierCount);
    this.state.selectedSoldierCount = Math.min(this.state.maxSoldiers, Math.floor(soldierCount / 2));
    this.state.mode = 'ADJUST_SOLDIERS';
    this.state.isMoving = true;
  }

  private handleSoldierAdjustment(soldierCount?: number): void {
    if (soldierCount === undefined) return;

    this.state.selectedSoldierCount = Math.max(1, Math.min(soldierCount, this.state.maxSoldiers));

    // After soldier adjustment, move to target selection mode
    this.state.mode = 'SELECT_TARGET';
  }

  private async handleTargetSelection(regionIndex?: number): Promise<void> {
    if (regionIndex === undefined || this.state.sourceRegion === null) return;

    // If we're in ADJUST_SOLDIERS mode and clicking a different region, set it as target
    if (this.state.mode === 'ADJUST_SOLDIERS') {
      // Validate target is adjacent
      if (!this.areRegionsAdjacent(this.state.sourceRegion, regionIndex)) {
        console.warn('Target region must be adjacent to source');
        return;
      }

      // Set target and trigger soldier selection
      this.state.targetRegion = regionIndex;
      this.notifyNeedsSoldierSelection();
      return;
    }

    // If we're in SELECT_TARGET mode, execute the move
    if (this.state.mode === 'SELECT_TARGET') {
      // Validate target is adjacent
      if (!this.areRegionsAdjacent(this.state.sourceRegion, regionIndex)) {
        console.warn('Target region must be adjacent to source');
        return;
      }

      this.state.targetRegion = regionIndex;

      // Execute the move immediately
      await this.executeMove();
    }
  }

  private async handleConfirmMove(): Promise<void> {
    if (this.state.sourceRegion === null ||
        this.state.targetRegion === null ||
        !this.onMoveComplete) {
      console.error('Cannot confirm move - missing data or callback');
      return;
    }

    try {
      console.log('Executing move:', {
        from: this.state.sourceRegion,
        to: this.state.targetRegion,
        soldiers: this.state.selectedSoldierCount
      });

      // Execute the move
      await this.onMoveComplete(
        this.state.sourceRegion,
        this.state.targetRegion,
        this.state.selectedSoldierCount
      );

      // Move completed successfully - reset to idle state
      this.resetToIdle();

    } catch (error) {
      console.error('Move failed:', error);
      // Reset state even on error to prevent UI from getting stuck
      this.resetToIdle();
    }
  }

  private resetToIdle(): void {
    // Explicitly reset all state to idle
    this.state = {
      mode: 'IDLE',
      sourceRegion: null,
      targetRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves: this.gameState?.movesRemaining ?? this.state.availableMoves,
      isMoving: false
    };

    // Notify UI of the state change
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  private handleCancel(): void {
    this.resetToIdle();
  }

  /**
   * Update the game state and handle post-move cleanup
   * This is called when receiving WebSocket updates
   */
  updateGameState(newGameState: any): void {
    this.gameState = newGameState;
    this.state.availableMoves = newGameState?.movesRemaining ?? this.state.availableMoves;

    // If we were in the middle of a move and the game state updated,
    // it likely means our move was processed successfully
    // Reset to idle state to allow new moves
    if (this.state.isMoving && this.state.mode === 'SELECT_TARGET') {
      console.log('Move appears to have been processed, resetting to idle');
      this.resetToIdle();
      return; // Don't call onStateChange again since resetToIdle already did
    }

    // Notify of state change to update UI
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  private async executeMove(): Promise<void> {
    if (this.state.sourceRegion === null ||
        this.state.targetRegion === null ||
        this.state.selectedSoldierCount <= 0 ||
        !this.onMoveComplete) {
      console.warn('Cannot execute move: invalid state', {
        sourceRegion: this.state.sourceRegion,
        targetRegion: this.state.targetRegion,
        selectedSoldierCount: this.state.selectedSoldierCount,
        hasCallback: !!this.onMoveComplete
      });
      return;
    }

    try {
      console.log('Executing move:', {
        from: this.state.sourceRegion,
        to: this.state.targetRegion,
        soldiers: this.state.selectedSoldierCount
      });

      await this.onMoveComplete(
        this.state.sourceRegion,
        this.state.targetRegion,
        this.state.selectedSoldierCount
      );

      // Move completed successfully
      this.state.availableMoves = Math.max(0, this.state.availableMoves - 1);
      this.handleCancel(); // Reset to idle state
    } catch (error) {
      console.error('Move failed:', error);
      // Could emit error event here
    }
  }

  // Helper methods for game state validation
  private isPlayerRegion(regionIndex: number): boolean {
    const currentPlayerIndex = this.gameState?.playerIndex;
    return this.gameState?.ownersByRegion?.[regionIndex] === currentPlayerIndex;
  }

  private getSoldierCountAtRegion(regionIndex: number): number {
    const soldiers = this.gameState?.soldiersByRegion?.[regionIndex];
    return soldiers ? soldiers.length : 0;
  }

  private hasRegionMovedThisTurn(regionIndex: number): boolean {
    // Check if this region is in the list of regions that have moved this turn
    return this.gameState?.conqueredRegions?.includes(regionIndex) ?? false;
  }

  private areRegionsAdjacent(sourceIndex: number, targetIndex: number): boolean {
    const sourceRegion = this.gameState?.regions?.[sourceIndex];
    return sourceRegion?.neighbors?.includes(targetIndex) ?? false;
  }

  private notifyNeedsSoldierSelection(): void {
    // Trigger the soldier selection modal through state change
    // The UI component will detect this mode and show the modal
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  // Public methods for UI integration
  canSelectRegion(regionIndex: number): boolean {
    switch (this.state.mode) {
      case 'IDLE':
      case 'SELECT_SOURCE':
        return this.isPlayerRegion(regionIndex) &&
               this.getSoldierCountAtRegion(regionIndex) > 1 &&
               !this.hasRegionMovedThisTurn(regionIndex);

      case 'ADJUST_SOLDIERS':
        return regionIndex === this.state.sourceRegion ||
               this.areRegionsAdjacent(this.state.sourceRegion!, regionIndex);

      case 'SELECT_TARGET':
        return this.areRegionsAdjacent(this.state.sourceRegion!, regionIndex);

      default:
        return false;
    }
  }

  getRegionHighlight(regionIndex: number): 'source' | 'target' | 'available' | 'none' {
    if (regionIndex === this.state.sourceRegion) return 'source';
    if (regionIndex === this.state.targetRegion) return 'target';
    if (this.canSelectRegion(regionIndex)) return 'available';
    return 'none';
  }

  getCurrentInstruction(): string {
    switch (this.state.mode) {
      case 'SELECT_SOURCE':
        return 'Click on a region to move or attack with its army.';
      case 'ADJUST_SOLDIERS':
        return 'Click on this region again to choose how many to move.\nClick on a target region to move the army.';
      case 'SELECT_TARGET':
        return 'Click on a target region to move the army.';
      case 'BUILD':
        return 'Click on a temple to buy soldiers or upgrades.';
      default:
        return 'Click on a region to move or attack with its army.\nClick on a temple to buy soldiers or upgrades.';
    }
  }
}
