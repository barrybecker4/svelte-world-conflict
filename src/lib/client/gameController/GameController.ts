import { writable, get, type Writable } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';
import { ModalManager } from './ModalManager';
import { GameApiClient } from './GameApiClient';
import { UndoManager } from './UndoManager';
import { TutorialCoordinator } from './TutorialCoordinator';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';
import type { PendingMove } from './types';

/**
 * Single controller that manages all game logic
 * The component just renders based on this controller's state
 */
export class GameController {
  // Stores
  private moveState: Writable<MoveState>;

  // Managers
  private modalManager: ModalManager;
  private apiClient: GameApiClient;
  private battleManager: BattleManager;
  private websocket: ReturnType<typeof useGameWebSocket>;
  private gameStore: any;
  private undoManager: UndoManager;

  // Coordinators
  private tutorialCoordinator: TutorialCoordinator;
  private turnTimerCoordinator: TurnTimerCoordinator;

  // State
  private gameEndChecked = false;
  private lastTurnNumber: number = -1;
  private battleInProgress = false;

  constructor(
    private gameId: string,
    private playerId: string,
    gameStore: any
  ) {
    this.gameStore = gameStore;

    // Initialize managers
    this.modalManager = new ModalManager();
    this.apiClient = new GameApiClient(gameId);
    this.undoManager = new UndoManager();

    // Initialize coordinators
    this.tutorialCoordinator = new TutorialCoordinator(playerId);
    this.turnTimerCoordinator = new TurnTimerCoordinator(playerId, () => this.endTurn());

    // Initialize stores
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

    this.battleManager = new BattleManager(gameId, null as any);
    this.websocket = useGameWebSocket(gameId, (gameData) => {
      // Check if turn has changed - if so, reset undo manager
      if (gameData.turnNumber !== undefined && gameData.turnNumber !== this.lastTurnNumber) {
        console.log(`🔄 Turn changed from ${this.lastTurnNumber} to ${gameData.turnNumber} - resetting undo manager`);
        this.lastTurnNumber = gameData.turnNumber;
        this.undoManager.reset();
      }
      
      this.gameStore.handleGameStateUpdate(gameData);
      // Update tooltips after game state changes from websocket
      this.updateTooltips();
    });

    // Set callback to start timer when player's turn is ready
    this.gameStore.setOnTurnReadyCallback((gameState: GameStateData) => {
      this.turnTimerCoordinator.handleTurnChange(gameState);
    });
  }

  /**
   * Initialize the game - call this from onMount
   */
  async initialize(mapContainer: HTMLElement | undefined): Promise<void> {
    if (mapContainer) {
      this.battleManager.setMapContainer(mapContainer);

      // Connect battle animation system to move replayer for AI/multiplayer battle animations
      const battleAnimationSystem = this.battleManager.getBattleAnimationSystem();
      this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
    } else {
      console.warn('⚠️ GameController: Map container not provided, animations will be disabled');
    }

    // Initialize game store with our callbacks
    const { gameState: initialGameState } = await this.gameStore.initializeGame(
      (source: number, target: number, count: number) => this.handleMoveComplete(source, target, count),
      (newState: MoveState) => this.handleMoveStateChange(newState)
    );

    // Register callback to check if battle is in progress
    this.gameStore.setIsBattleInProgressCallback(() => this.isBattleInProgress());

    await this.websocket.initialize();
    await audioSystem.enable();

    // Start timer for initial turn if it's this player's turn
    if (initialGameState) {
      this.turnTimerCoordinator.handleTurnChange(initialGameState);
      // Initialize turn tracking
      this.lastTurnNumber = initialGameState.turnNumber || 0;
      console.log(`🎮 Initial turn number: ${this.lastTurnNumber}`);
    }

    // Initialize tooltips after game state is loaded
    console.log('📖 GameController: Initializing tooltips after game load');
    this.updateTooltips();

    // Listen for battle state updates (for soldier positioning animations)
    if (typeof window !== 'undefined') {
      window.addEventListener('battleStateUpdate', ((event: CustomEvent) => {
        console.log('⚔️ Received battleStateUpdate event, updating game state for animation');
        // Update store directly to avoid queuing delays
        this.gameStore.gameState.set(event.detail.gameState);
      }) as EventListener);
    }
  }

  /**
   * Set the map container for battle animations (can be called after initialization)
   */
  setMapContainer(container: HTMLElement): void {
    console.log('🗺️ GameController: Setting map container');
    this.battleManager.setMapContainer(container);

    // Also connect battle animation system to move replayer
    const battleAnimationSystem = this.battleManager.getBattleAnimationSystem();
    this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
  }

  /**
   * Cleanup - call this from onDestroy
   */
  destroy(): void {
    this.turnTimerCoordinator.stopTimer();
    this.battleManager?.destroy();
    this.websocket.cleanup();
    this.gameStore.resetTurnManager();
  }

  /**
   * Handle move state changes
   */
  private handleMoveStateChange(newState: MoveState): void {
    console.log('🔄 GameController.handleMoveStateChange:', newState);
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
    this.updateTooltips();
  }

  /**
   * Handle move completion - execute through BattleManager with animations
   */
  private async handleMoveComplete(
    sourceRegionIndex: number,
    targetRegionIndex: number,
    soldierCount: number
  ): Promise<void> {
    const gameState = this.gameStore.gameState;
    let currentState: GameStateData;

    gameState.subscribe((value: GameStateData) => {
      currentState = value;
    })();

    // Save state before making the move (for undo)
    const playerSlotIndex = parseInt(this.playerId);
    this.undoManager.saveState(currentState!, playerSlotIndex);

    const battleMove = {
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      gameState: currentState!
    };

    // Get regions for animations
    const regions = this.gameStore.regions;
    let currentRegions: any[];
    regions.subscribe((value: any[]) => {
      currentRegions = value;
    })();

    // Mark battle as in progress to delay WebSocket updates
    this.battleInProgress = true;
    console.log('🔒 Battle in progress, WebSocket updates will be delayed');
    
    // Execute move through BattleManager (sends to server immediately for validation and persistence)
    const result = await this.battleManager.executeMove(battleMove, this.playerId, currentRegions!);

    if (!result.success) {
      throw new Error(result.error || 'Move failed');
    }

    // Check for player eliminations after the move
    if (result.gameState) {
      this.checkForEliminations(result.gameState);
    }

    // Update tutorial tooltips after move completes
    this.updateTooltips();

    // Immediately update game state with the result from server
    if (result.gameState) {
      console.log('✅ GameController: Updating game state from server response');
      this.gameStore.handleGameStateUpdate(result.gameState);
    }
    
    // Clear battle in progress flag
    this.battleInProgress = false;
    console.log('🔓 Battle complete, WebSocket updates resumed');
  }
  
  /**
   * Check if a battle is currently in progress
   */
  isBattleInProgress(): boolean {
    return this.battleInProgress;
  }

  /**
   * Check for player eliminations and show banners immediately
   */
  private checkForEliminations(gameState: GameStateData): void {
    const players = gameState.players || [];
    const ownersByRegion = gameState.ownersByRegion || {};

    // Count regions owned by each player
    const regionCounts = new Map<number, number>();
    for (const playerSlotIndex of Object.values(ownersByRegion)) {
      regionCounts.set(playerSlotIndex, (regionCounts.get(playerSlotIndex) || 0) + 1);
    }

    // Check each player - if they have 0 regions, they're eliminated
    for (const player of players) {
      const regionCount = regionCounts.get(player.slotIndex) || 0;
      if (regionCount === 0) {
        console.log(`💀 Player ${player.name} (slot ${player.slotIndex}) has been eliminated!`);
        this.gameStore.showEliminationBanner(player.slotIndex);
      }
    }
  }

  /**
   * Check for game end
   */
  checkGameEnd(gameState: GameStateData | null, players: Player[]): void {
    if (!gameState || players.length === 0 || this.gameEndChecked) {
      return;
    }

    const endResult = checkGameEnd(gameState, players);

    if (endResult.isGameEnded) {
      this.gameEndChecked = true;

      // Stop the timer when the game ends
      this.turnTimerCoordinator.stopTimer();

      // Play sound
      const isWinner =
        endResult.winner !== 'DRAWN_GAME' &&
        endResult.winner?.slotIndex?.toString() === this.playerId;

      audioSystem.playSound(isWinner ? SOUNDS.GAME_WON : SOUNDS.GAME_LOST);

      // Show modal (winner is guaranteed to exist when game has ended)
      this.modalManager.showGameSummary(endResult.winner!);
    }
  }

  /**
   * Handle region click from map
   */
  handleRegionClick(region: any, isMyTurn: boolean): void {
    console.log('🖱️ GameController.handleRegionClick:', {
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
    console.log('🏛️ GameController.handleTempleClick:', {
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
   * Handle soldier count change (for real-time updates in modal)
   */
  handleSoldierCountChange(count: number): void {
    this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));
  }

  /**
   * Confirm soldier selection
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
    console.log('🏛️ GameController.closeTempleUpgradePanel');
    const moveSystem = this.gameStore.getMoveSystem();
    moveSystem?.processAction({ type: 'CANCEL' });
  }

  /**
   * Purchase an upgrade for a temple
   * Note: Temple upgrades are sent immediately to the server and cannot be undone
   */
  async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
    try {
      const data = await this.apiClient.purchaseUpgrade(this.playerId, regionIndex, upgradeIndex);

      // Temple upgrades are immediate operations, so disable undo
      // (similar to how battles disable undo in the old GAS implementation)
      this.undoManager.disableUndo();
      console.log('🏛️ Temple upgrade purchased - undo disabled');

      // Update game state
      if (data.gameState) {
        this.gameStore.handleGameStateUpdate(data.gameState);
      }

      // Don't close the panel - keep it open so player can see updated options
      // and potentially purchase additional upgrades (like the second level)
      console.log('💰 Purchase complete, panel remains open for additional purchases');

    } catch (error) {
      console.error('❌ Purchase upgrade error:', error);
      alert('Error purchasing upgrade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * End turn - send all accumulated moves to server
   */
  async endTurn(): Promise<void> {
    // Stop the timer when ending turn
    this.turnTimerCoordinator.stopTimer();

    try {
      // Moves are sent to server immediately when made (not batched)
      console.log(`🔚 Ending turn (moves already sent to server)`);

      // Send end turn with empty pending moves array
      console.log('🔚 Sending endTurn request to server...');
      const result = await this.apiClient.endTurn(this.playerId, []);
      console.log('🔚 EndTurn response received:', result);

      // Reset move state
      this.moveState.set({
        mode: 'IDLE',
        sourceRegion: null,
        targetRegion: null,
        buildRegion: null,
        selectedSoldierCount: 0,
        maxSoldiers: 0,
        availableMoves: 3,
        isMoving: false
      });
    } catch (error) {
      console.error('❌ End turn error:', error);
      alert('Failed to end turn: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Undo the last move
   */
  async undo(): Promise<void> {
    const gameState = get(this.gameStore.gameState);
    const playerSlotIndex = parseInt(this.playerId);
    
    if (!this.undoManager.canUndo(gameState, playerSlotIndex)) {
      console.warn('⚠️ Cannot undo - conditions not met');
      return;
    }

    console.log('↩️ GameController: Performing undo');

    // Get the previous state
    const previousState = this.undoManager.undo();
    
    if (!previousState) {
      console.warn('⚠️ No previous state available for undo');
      return;
    }

    // Clear any active move UI state
    this.moveState.set({
      mode: 'IDLE',
      sourceRegion: null,
      targetRegion: null,
      buildRegion: null,
      selectedSoldierCount: 0,
      maxSoldiers: 0,
      availableMoves: previousState.movesRemaining || 3,
      isMoving: false
    });

    // Close any open modals
    this.modalManager.hideSoldierSelection();

    // Update the game state with the previous state
    this.gameStore.handleGameStateUpdate(previousState);

    // Reset move system if available
    const moveSystem = this.gameStore.getMoveSystem();
    if (moveSystem) {
      moveSystem.reset();
    }

    // Update tooltips
    this.updateTooltips();

    console.log('✅ Undo complete');
  }

  /**
   * Check if undo is currently available
   */
  canUndo(): boolean {
    const gameState = get(this.gameStore.gameState);
    const playerSlotIndex = parseInt(this.playerId);
    return this.undoManager.canUndo(gameState, playerSlotIndex);
  }

  showInstructions(): void {
    this.modalManager.showInstructions();
  }

  closeInstructions(): void {
    this.modalManager.closeInstructions();
  }

  closeGameSummary(): void {
    this.modalManager.closeGameSummary();
  }

  /**
   * Resign from the game
   */
  async resign(): Promise<void> {
    if (!confirm('Are you sure you want to resign from this game?')) {
      return;
    }

    try {
      const result = await this.apiClient.resign(this.playerId);

      // If game ended, show summary or redirect
      if (result.gameEnded) {
        // Redirect to home page
        window.location.href = '/';
      }
    } catch (error) {
      console.error('❌ Resign error:', error);
      alert('Failed to resign from game: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Update tutorial tooltips based on current game state
   */
  private updateTooltips(): void {
    const gameState = get(this.gameStore.gameState);
    const regions = get(this.gameStore.regions);
    const currentMoveState = get(this.moveState);

    this.tutorialCoordinator.updateTooltips(gameState, regions, currentMoveState);
  }

  /**
   * Dismiss a tutorial tooltip
   */
  dismissTooltip(tooltipId: string): void {
    this.tutorialCoordinator.dismissTooltip(tooltipId);
    this.updateTooltips();
  }

  /**
   * Get stores for component binding
   */
  getStores() {
    return {
      modalState: this.modalManager.getModalState(),
      moveState: this.moveState,
      isConnected: this.websocket.getConnectedStore(),
      tutorialTips: this.tutorialCoordinator.getTutorialTipsStore()
    };
  }
}


