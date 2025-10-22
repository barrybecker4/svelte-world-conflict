import { get } from 'svelte/store';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';
import { ModalManager } from './ModalManager';
import { GameApiClient } from './GameApiClient';
import { UndoManager } from './UndoManager';
import { TutorialCoordinator } from './TutorialCoordinator';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';
import { BattleCoordinator } from './BattleCoordinator';
import { MoveUICoordinator } from './MoveUICoordinator';
import { GameEndCoordinator } from './GameEndCoordinator';
import { TempleActionCoordinator } from './TempleActionCoordinator';
import type { PendingMove } from './types';

/**
 * Single controller that manages all game logic
 * The component just renders based on this controller's state
 */
export class GameController {
  // Managers
  private modalManager: ModalManager;
  private apiClient: GameApiClient;
  private websocket: ReturnType<typeof useGameWebSocket>;
  private gameStore: any;
  private undoManager: UndoManager;

  // Coordinators
  private tutorialCoordinator: TutorialCoordinator;
  private turnTimerCoordinator: TurnTimerCoordinator;
  private battleCoordinator: BattleCoordinator;
  private moveUICoordinator: MoveUICoordinator;
  private gameEndCoordinator: GameEndCoordinator;
  private templeActionCoordinator: TempleActionCoordinator;

  // State
  private lastTurnNumber: number = -1;

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
    this.battleCoordinator = new BattleCoordinator(gameId, playerId, gameStore, this.undoManager);
    this.moveUICoordinator = new MoveUICoordinator(gameStore, this.modalManager);
    this.gameEndCoordinator = new GameEndCoordinator(playerId, this.modalManager, this.turnTimerCoordinator);
    this.templeActionCoordinator = new TempleActionCoordinator(playerId, this.apiClient, this.undoManager, gameStore);

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
      this.battleCoordinator.setMapContainer(mapContainer);

      // Connect battle animation system to move replayer for AI/multiplayer battle animations
      const battleAnimationSystem = this.battleCoordinator.getBattleAnimationSystem();
      this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
    } else {
      console.warn('⚠️ GameController: Map container not provided, animations will be disabled');
    }

    // Initialize game store with our callbacks
    const { gameState: initialGameState } = await this.gameStore.initializeGame(
      (source: number, target: number, count: number) => 
        this.battleCoordinator.handleMoveComplete(source, target, count, () => this.updateTooltips()),
      (newState) => this.moveUICoordinator.handleMoveStateChange(newState, () => this.updateTooltips())
    );

    // Register callback to check if battle is in progress
    this.gameStore.setIsBattleInProgressCallback(() => this.battleCoordinator.isBattleInProgress());

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
    this.battleCoordinator.setMapContainer(container);

    // Also connect battle animation system to move replayer
    const battleAnimationSystem = this.battleCoordinator.getBattleAnimationSystem();
    this.gameStore.setBattleAnimationSystem(battleAnimationSystem);
  }

  /**
   * Cleanup - call this from onDestroy
   */
  destroy(): void {
    this.turnTimerCoordinator.stopTimer();
    this.battleCoordinator.destroy();
    this.websocket.cleanup();
    this.gameStore.resetTurnManager();
  }

  /**
   * Check for game end (delegates to GameEndCoordinator)
   */
  checkGameEnd(gameState: GameStateData | null, players: Player[]): void {
    this.gameEndCoordinator.checkGameEnd(gameState, players);
  }

  /**
   * Handle region click from map (delegates to MoveUICoordinator)
   */
  handleRegionClick(region: any, isMyTurn: boolean): void {
    this.moveUICoordinator.handleRegionClick(region, isMyTurn);
  }

  /**
   * Handle temple click from map (delegates to MoveUICoordinator)
   */
  handleTempleClick(regionIndex: number, isMyTurn: boolean): void {
    this.moveUICoordinator.handleTempleClick(regionIndex, isMyTurn);
  }

  /**
   * Handle soldier count change (delegates to MoveUICoordinator)
   */
  handleSoldierCountChange(count: number): void {
    this.moveUICoordinator.handleSoldierCountChange(count);
  }

  /**
   * Confirm soldier selection (delegates to MoveUICoordinator)
   */
  confirmSoldierSelection(count: number): void {
    this.moveUICoordinator.confirmSoldierSelection(count);
  }

  /**
   * Cancel soldier selection (delegates to MoveUICoordinator)
   */
  cancelSoldierSelection(): void {
    this.moveUICoordinator.cancelSoldierSelection();
  }

  /**
   * Close temple upgrade panel (delegates to MoveUICoordinator)
   */
  closeTempleUpgradePanel(): void {
    this.moveUICoordinator.closeTempleUpgradePanel();
  }

  /**
   * Purchase temple upgrade (delegates to TempleActionCoordinator)
   */
  async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
    await this.templeActionCoordinator.purchaseUpgrade(regionIndex, upgradeIndex);
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
      this.moveUICoordinator.resetMoveState();
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
    this.moveUICoordinator.resetMoveState(previousState.movesRemaining || 3);

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
    const currentMoveState = get(this.moveUICoordinator.getMoveStateStore());

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
      moveState: this.moveUICoordinator.getMoveStateStore(),
      isConnected: this.websocket.getConnectedStore(),
      tutorialTips: this.tutorialCoordinator.getTutorialTipsStore()
    };
  }
}


