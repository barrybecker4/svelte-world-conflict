import { get } from 'svelte/store';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';
import { ModalManager } from './ModalManager';
import { GameApiClient } from './GameApiClient';
import { UndoManager } from './UndoManager';
import { MoveQueue } from './MoveQueue';
import { LocalMoveExecutor } from './LocalMoveExecutor';
import { TutorialCoordinator } from './TutorialCoordinator';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';
import { BattleCoordinator } from './BattleCoordinator';
import { MoveUICoordinator } from './MoveUICoordinator';
import { GameEndCoordinator } from './GameEndCoordinator';
import { GameStateUpdater } from '$lib/client/stores/GameStateUpdater';
import { GameState } from '$lib/game/state/GameState';
import { BuildCommand } from '$lib/game/commands/BuildCommand';
import { CommandProcessor } from '$lib/game/commands/CommandProcessor';

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
  private moveQueue: MoveQueue;
  private localExecutor: LocalMoveExecutor;

  // Coordinators
  private tutorialCoordinator: TutorialCoordinator;
  private turnTimerCoordinator: TurnTimerCoordinator;
  private battleCoordinator: BattleCoordinator;
  private moveUICoordinator: MoveUICoordinator;
  private gameEndCoordinator: GameEndCoordinator;

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
    this.moveQueue = new MoveQueue();
    this.localExecutor = new LocalMoveExecutor();

    // Initialize coordinators
    this.tutorialCoordinator = new TutorialCoordinator(playerId);
    this.turnTimerCoordinator = new TurnTimerCoordinator(playerId, () => this.endTurn());
    this.battleCoordinator = new BattleCoordinator(playerId, gameStore, this.undoManager, this.moveQueue);
    this.moveUICoordinator = new MoveUICoordinator(gameStore, this.modalManager);
    this.gameEndCoordinator = new GameEndCoordinator(
      playerId, 
      this.modalManager, 
      this.turnTimerCoordinator,
      (updater) => gameStore.gameState.update(updater)
    );

    this.websocket = useGameWebSocket(gameId, (gameData) => {
      // Check if turn has changed - if so, reset undo manager and move queue
      if (gameData.turnNumber !== undefined && gameData.turnNumber !== this.lastTurnNumber) {
        console.log(`🔄 Turn changed from ${this.lastTurnNumber} to ${gameData.turnNumber} - resetting undo manager and move queue`);
        this.lastTurnNumber = gameData.turnNumber;
        this.undoManager.reset();
        this.moveQueue.clear();
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
        // Note: We allow these updates during AI replay as they ARE the animation states we want to show
        this.gameStore.gameState.set(event.detail.gameState);
      }) as EventListener);
    }

    // Trigger AI processing if current player is AI
    // This is done after client is fully initialized and connected
    if (initialGameState) {
      const currentPlayer = initialGameState.players?.find(
        (p: any) => p.slotIndex === initialGameState.currentPlayerSlot
      );
      if (currentPlayer?.isAI) {
        console.log('🤖 Current player is AI, triggering AI processing after client ready');
        this.triggerAiProcessing();
      }
    }
  }

  /**
   * Trigger AI turn processing on the server
   * Called after client has loaded initial state and connected to WebSocket
   */
  private async triggerAiProcessing(): Promise<void> {
    try {
      const response = await fetch(`/api/game/${this.gameId}/process-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.error('❌ Failed to trigger AI processing:', response.statusText);
      } else {
        console.log('✅ AI processing triggered successfully');
      }
    } catch (error) {
      console.error('❌ Error triggering AI processing:', error);
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
   * Purchase temple upgrade (execute locally and queue for server)
   */
  async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
    const gameState = get(this.gameStore.gameState) as GameStateData | null;
    const playerSlotIndex = parseInt(this.playerId);

    if (!gameState) {
      console.error('❌ No game state available');
      return;
    }

    try {
      // Save state for undo
      this.undoManager.saveState(gameState, playerSlotIndex);

      // Execute the BUILD command locally
      const gameStateObj = new GameState(gameState);
      const player = gameStateObj.getPlayerBySlotIndex(playerSlotIndex);
      
      if (!player) {
        throw new Error(`Player not found: ${playerSlotIndex}`);
      }

      const command = new BuildCommand(gameStateObj, player, regionIndex, upgradeIndex);
      const processor = new CommandProcessor();
      const result = processor.process(command);

      if (!result.success) {
        throw new Error(result.error || 'Build command failed');
      }

      // Update local game state
      const newGameStateData = result.newState!.toJSON();
      this.gameStore.handleGameStateUpdate(newGameStateData);

      // Queue the move to be sent at turn end
      this.moveQueue.push({
        type: 'BUILD',
        regionIndex,
        upgradeIndex
      });

      // Temple upgrades disable undo (like battles)
      this.undoManager.disableUndo();
      console.log('🏛️ Temple upgrade purchased locally - undo disabled');

    } catch (error) {
      console.error('❌ Purchase upgrade error:', error);
      alert('Error purchasing upgrade: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * End turn - send all queued moves to server and transition to next player
   */
  async endTurn(): Promise<void> {
    // Stop the timer when ending turn
    this.turnTimerCoordinator.stopTimer();

    try {
      // Get all queued moves
      const queuedMoves = this.moveQueue.getAll();
      console.log(`🔚 Ending turn with ${queuedMoves.length} queued moves`);

      // Send end turn with all queued moves
      console.log('🔚 Sending endTurn request to server with queued moves...');
      const result = await this.apiClient.endTurn(this.playerId, queuedMoves);
      console.log('🔚 EndTurn response received:', result);

      // Clear the move queue after successful send
      this.moveQueue.clear();

      // Reset move state
      this.moveUICoordinator.resetMoveState();
    } catch (error) {
      console.error('❌ End turn error:', error);
      alert('Failed to end turn: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Undo the last move (client-side only until turn ends)
   */
  async undo(): Promise<void> {
    const gameState = get(this.gameStore.gameState) as GameStateData | null;
    const playerSlotIndex = parseInt(this.playerId);

    if (!this.undoManager.canUndo(gameState, playerSlotIndex)) {
      console.warn('⚠️ Cannot undo - conditions not met');
      return;
    }

    console.log('↩️ GameController: Performing local undo');

    // Get the previous state
    const previousState = this.undoManager.undo();

    if (!previousState) {
      console.warn('⚠️ No previous state available for undo');
      return;
    }

    // Remove the last move from the queue (it was never sent to server)
    const removedMove = this.moveQueue.pop();
    console.log('↩️ Removed move from queue:', removedMove);

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

    console.log('✅ Undo complete (local only, moves sent at turn end)');
  }

  /**
   * Check if undo is currently available
   */
  canUndo(): boolean {
    const gameState = get(this.gameStore.gameState) as GameStateData | null;
    const playerSlotIndex = parseInt(this.playerId);
    return this.undoManager.canUndo(gameState, playerSlotIndex);
  }

  showInstructions(): void {
    this.modalManager.showInstructions();
  }

  closeInstructions(): void {
    this.modalManager.closeInstructions();
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
    const gameState = get(this.gameStore.gameState) as GameStateData | null;
    const regions = get(this.gameStore.regions) as any[];
    const currentMoveState = get(this.moveUICoordinator.getMoveStateStore());

    this.tutorialCoordinator.updateTooltips(gameState, regions, currentMoveState as any);
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


