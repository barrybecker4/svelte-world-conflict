import type { MoveState, MoveAction } from './moveTypes';
import {
  IDLE,
  SELECT_SOURCE,
  ADJUST_SOLDIERS,
  SELECT_TARGET,
  BUILD,
  RESET,
  CANCEL,
  CONFIRM_MOVE,
  ENTER_BUILD_MODE
} from './moveConstants';

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
      mode: IDLE,
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves: 3,
      isMoving: false
    };
  }

  /**
   * Main entry point for handling region clicks
   */
  handleRegionClick(regionIndex: number): void {
    console.log(`🖱️ MoveSystem.handleRegionClick: ${regionIndex}, current mode: ${this.state.mode}`);

    switch (this.state.mode) {
      case IDLE:
        this.selectSourceRegion(regionIndex);
        break;

      case SELECT_SOURCE:
        this.selectSourceRegion(regionIndex);
        break;

      case ADJUST_SOLDIERS:
        // Click during soldier adjustment = cancel
        this.cancelMove();
        break;

      case SELECT_TARGET:
        this.selectTargetRegion(regionIndex);
        break;

      case BUILD:
        // Building mode - ignore region clicks or cancel
        this.cancelMove();
        break;

      default:
        console.warn('Unknown mode:', this.state.mode);
    }
  }

  /**
   * Process an action (called from UI or internal state transitions)
   */
  processAction(action: MoveAction): void {
    console.log(`🎬 MoveSystem.processAction:`, action);

    switch (action.type) {
      case SELECT_SOURCE:
        if (action.payload?.regionIndex !== undefined) {
          this.selectSourceRegion(action.payload.regionIndex);
        }
        break;

      case ADJUST_SOLDIERS:
        if (action.payload?.soldierCount !== undefined) {
          this.adjustSoldierCount(action.payload.soldierCount);
        }
        break;

      case SELECT_TARGET:
        if (action.payload?.regionIndex !== undefined) {
          this.selectTargetRegion(action.payload.regionIndex);
        }
        break;

      case CONFIRM_MOVE:
        this.confirmMove();
        break;

      case CANCEL:
        this.cancelMove();
        break;

      case RESET:
        this.reset();
        break;

      case ENTER_BUILD_MODE:
        this.enterBuildMode();
        break;

      default:
        console.warn('Unknown action type:', (action as any).type);
    }
  }

  /**
   * Step 1: Select source region
   */
  private selectSourceRegion(regionIndex: number): void {
    console.log(`🎯 MoveSystem.selectSourceRegion: ${regionIndex}`);

    const currentPlayerSlot = this.gameState.currentPlayerSlot;
    const owner = this.gameState.ownersByRegion[regionIndex];

    // Validate ownership
    if (owner !== currentPlayerSlot) {
      console.log('Cannot select region - not owned by current player');
      return;
    }

    // Check if region was conquered this turn
    if (this.gameState.conqueredRegions?.includes(regionIndex)) {
      console.log('Cannot select region - conquered this turn');
      return;
    }

    // Count soldiers
    const soldiers = this.gameState.soldiersByRegion[regionIndex] || [];
    if (soldiers.length === 0) {
      console.log('Cannot select region - no soldiers to move');
      return;
    }

    // Set state and notify - go directly to target selection
    this.updateState({
      mode: SELECT_TARGET,
      sourceRegion: regionIndex,
      targetRegion: null,
      buildRegion: null,
      maxSoldiers: soldiers.length, // Can move all soldiers
      selectedSoldierCount: Math.min(soldiers.length, 1), // Default to 1 soldier
      isMoving: false,
      availableMoves: this.state.availableMoves
    });

    console.log('✅ Source region selected, transitioning to SELECT_TARGET');
  }

  /**
   * Handle temple click - enters BUILD mode
   */
  handleTempleClick(regionIndex: number): void {
    console.log(`🏛️ MoveSystem.handleTempleClick: ${regionIndex}`);

    const currentPlayerSlot = this.gameState.currentPlayerSlot;
    const owner = this.gameState.ownersByRegion[regionIndex];

    // Validate ownership
    if (owner !== currentPlayerSlot) {
      console.log('Cannot select temple - not owned by current player');
      return;
    }

    // Check if this region has a temple
    const temple = this.gameState.templesByRegion[regionIndex];
    if (!temple) {
      console.log('No temple at this region');
      return;
    }

    console.log('🏛️ Temple click confirmed - entering BUILD mode');
    this.updateState({
      mode: BUILD,
      sourceRegion: null,
      targetRegion: null,
      buildRegion: regionIndex,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      isMoving: false,
      availableMoves: this.state.availableMoves
    });
  }

  /**
   * Step 2: Adjust soldier count
   */
  private adjustSoldierCount(count: number): void {
    console.log(`👥 MoveSystem.adjustSoldierCount: ${count}`);

    // Validate
    if (count < 1 || count > this.state.maxSoldiers) {
      console.warn('Invalid soldier count:', count);
      return;
    }

    // Update soldier count and execute the move
    this.updateState({
      ...this.state,
      selectedSoldierCount: count,
      isMoving: true
    });

    console.log('✅ Soldier count adjusted, executing move');
    this.executeMove();
  }

  /**
   * Step 3: Select target region
   */
  private selectTargetRegion(regionIndex: number): void {
    console.log(`🎯 MoveSystem.selectTargetRegion: ${regionIndex}`);

    if (this.state.sourceRegion === null) {
      console.error('No source region selected');
      return;
    }

    // Can't move to the same region
    if (regionIndex === this.state.sourceRegion) {
      console.log('Cannot move to the same region');
      this.cancelMove();
      return;
    }

    // Check if regions are adjacent - regions is now an array
    const sourceRegion = this.gameState.regions.find((r: any) => r.index === this.state.sourceRegion);
    if (!sourceRegion) {
      console.error('Source region not found');
      return;
    }

    if (!sourceRegion.neighbors.includes(regionIndex)) {
      console.log('Target region is not adjacent');
      return;
    }

    // Validate move before opening soldier selection modal
    // Check with minimum soldier count (1) to ensure move is valid
    const availableSoldiers = this.gameState.soldiersByRegion[this.state.sourceRegion]?.length || 0;
    if (availableSoldiers < 1) {
      console.log('Not enough soldiers to move (need at least 1)');
      this.cancelMove();
      return;
    }

    // Set target and transition to soldier selection
    this.updateState({
      ...this.state,
      targetRegion: regionIndex,
      mode: ADJUST_SOLDIERS,
      isMoving: false
    });

    console.log('✅ Target region selected, transitioning to ADJUST_SOLDIERS');
  }

  /**
   * Execute the move
   */
  private async executeMove(): Promise<void> {
    const { sourceRegion, targetRegion, selectedSoldierCount } = this.state;

    if (sourceRegion === null || targetRegion === null) {
      console.error('Cannot execute move - missing source or target');
      return;
    }

    console.log(`🚀 Executing move: ${sourceRegion} -> ${targetRegion}, ${selectedSoldierCount} soldiers`);

    try {
      // Call the callback
      if (this.onMoveComplete) {
        await this.onMoveComplete(sourceRegion, targetRegion, selectedSoldierCount);
      }

      console.log('✅ Move executed successfully');

      // Reset state
      this.updateState({
        mode: IDLE,
        sourceRegion: null,
        targetRegion: null,
        buildRegion: null,
        selectedSoldierCount: 0,
        maxSoldiers: 0,
        availableMoves: Math.max(0, this.state.availableMoves - 1),
        isMoving: false
      });

    } catch (error) {
      console.error('Move execution failed:', error);
      this.cancelMove();
    }
  }

  /**
   * Confirm the current move
   */
  private confirmMove(): void {
    console.log('✅ MoveSystem.confirmMove');

    if (this.state.mode === ADJUST_SOLDIERS && this.state.sourceRegion !== null && this.state.targetRegion !== null) {
      // Execute the move with the selected soldier count
      this.updateState({
        ...this.state,
        isMoving: true
      });
      this.executeMove();
    }
  }

  /**
   * Cancel the current move
   */
  private cancelMove(): void {
    console.log('MoveSystem.cancelMove');

    this.updateState({
      mode: IDLE,
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      isMoving: false,
      availableMoves: this.state.availableMoves
    });
  }

  /**
   * Reset the move system
   */
  reset(): void {
    console.log('🔄 MoveSystem.reset');

    this.updateState({
      mode: IDLE,
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
   * Enter build mode
   */
  private enterBuildMode(): void {
    console.log('🏗️ MoveSystem.enterBuildMode');

    this.updateState({
      mode: BUILD,
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      isMoving: false,
      availableMoves: this.state.availableMoves
    });
  }

  /**
   * Update game state reference
   */
  updateGameState(newGameState: any): void {
    this.gameState = newGameState;
  }

  /**
   * Get current state
   */
  getState(): MoveState {
    return { ...this.state };
  }

  /**
   * Get valid target regions for the currently selected source region
   * Returns empty array if no source selected or source is invalid
   */
  getValidTargetRegions(): number[] {
    if (this.state.sourceRegion === null) return [];

    const sourceRegion = this.gameState.regions.find((r: any) => r.index === this.state.sourceRegion);
    if (!sourceRegion) return [];

    // Check if source region is conquered this turn
    if (this.gameState.conqueredRegions?.includes(this.state.sourceRegion)) {
      return []; // Can't move from conquered regions
    }

    // Check if source has enough soldiers to move
    const availableSoldiers = this.gameState.soldiersByRegion[this.state.sourceRegion]?.length || 0;
    if (availableSoldiers < 1) {
      return []; // Can't move from regions with less than 2 soldiers
    }

    // Return neighboring regions
    return sourceRegion.neighbors || [];
  }

  /**
   * Update state and notify listeners
   */
  private updateState(newState: MoveState): void {
    this.state = { ...newState };

    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }
}
