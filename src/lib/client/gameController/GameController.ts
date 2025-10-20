import { writable, get, type Writable } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';
import { turnTimerStore } from '$lib/client/stores/turnTimerStore';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { ModalManager } from './ModalManager';
import { GameApiClient } from './GameApiClient';
import { TutorialTips, type TooltipData } from '$lib/client/feedback/TutorialTips';

/**
 * Single controller that manages all game logic
 * The component just renders based on this controller's state
 */
export class GameController {
  // Stores
  private moveState: Writable<MoveState>;
  private tutorialTips: Writable<TooltipData[]>;

  // Managers
  private modalManager: ModalManager;
  private apiClient: GameApiClient;
  private battleManager: BattleManager;
  private websocket: ReturnType<typeof useGameWebSocket>;
  private gameStore: any;
  private tutorialManager: TutorialTips;

  // State
  private gameEndChecked = false;

  constructor(
    private gameId: string,
    private playerId: string,
    gameStore: any
  ) {
    this.gameStore = gameStore;

    // Initialize managers
    this.modalManager = new ModalManager();
    this.apiClient = new GameApiClient(gameId);
    this.tutorialManager = new TutorialTips();

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
    this.tutorialTips = writable([]);

    this.battleManager = new BattleManager(gameId, null as any);
    this.websocket = useGameWebSocket(gameId, (gameData) => {
      this.gameStore.handleGameStateUpdate(gameData);
      // Update tooltips after game state changes from websocket
      this.updateTooltips();
    });

    // Set callback to start timer when player's turn is ready
    this.gameStore.setOnTurnReadyCallback((gameState: GameStateData) => {
      this.startTimerForPlayer(gameState);
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

    await this.websocket.initialize();
    await audioSystem.enable();

    // Start timer for initial turn if it's this player's turn
    if (initialGameState) {
      this.startTimerForPlayer(initialGameState);
    }

    // Initialize tooltips after game state is loaded
    console.log('📖 GameController: Initializing tooltips after game load');
    this.updateTooltips();
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
    turnTimerStore.stopTimer();
    this.battleManager?.destroy();
    this.websocket.cleanup();
    this.gameStore.resetTurnManager();
  }

  /**
   * Start the turn timer for the player when their turn is ready
   */
  private startTimerForPlayer(gameState: GameStateData): void {
    const playerSlotIndex = parseInt(this.playerId);
    const currentPlayerSlot = gameState.currentPlayerSlot;

    // Stop any existing timer first
    turnTimerStore.stopTimer();

    // Check if the game has ended - if so, don't start the timer
    const endResult = checkGameEnd(gameState, gameState.players);
    if (endResult.isGameEnded) {
      console.log('⏰ Game has ended, not starting timer');
      return;
    }

    // Start timer if it's this player's turn and they're human
    const isMyTurn = currentPlayerSlot === playerSlotIndex;
    const isHumanPlayer = gameState.players.some(p =>
      p.slotIndex === playerSlotIndex && !p.isAI
    );
    const timeLimit = gameState.moveTimeLimit || GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;

    console.log('⏰ ======== TURN TIMER CHECK ========');
    console.log('⏰ Timer conditions:', {
      isMyTurn,
      isHumanPlayer,
      timeLimit,
      playerSlotIndex,
      currentPlayerSlot,
      gameEnded: endResult.isGameEnded,
      players: gameState.players.map(p => ({
        slotIndex: p.slotIndex,
        name: p.name,
        isAI: p.isAI
      }))
    });

    // Always show timer when it's the player's turn (human only), but not for unlimited time
    const isUnlimitedTime = timeLimit === GAME_CONSTANTS.UNLIMITED_TIME;
    if (isMyTurn && isHumanPlayer && timeLimit && !isUnlimitedTime) {
      console.log(`⏰ ✅ Starting timer for ${timeLimit} seconds`);
      turnTimerStore.startTimer(timeLimit, () => {
        console.log('⏰ Timer expired, auto-ending turn');
        this.endTurn();
      });
    } else {
      console.log(`⏰ ❌ Timer NOT starting - conditions not met (isMyTurn: ${isMyTurn}, isHumanPlayer: ${isHumanPlayer}, timeLimit: ${timeLimit}, isUnlimitedTime: ${isUnlimitedTime})`);
    }
    console.log(`⏰ ===================================`);
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
   * Handle move completion
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

    const battleMove = {
      sourceRegionIndex,
      targetRegionIndex,
      soldierCount,
      gameState: currentState!
    };

    // Handle battle or peaceful move through BattleManager
    const regions = this.gameStore.regions;
    let currentRegions: any[];
    regions.subscribe((value: any[]) => {
      currentRegions = value;
    })();

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

    // Immediately update game state with the result from the API
    // This ensures the new state is shown when animation overrides clear
    // The WebSocket update will arrive later but will be ignored if it's the same state
    if (result.gameState) {
      console.log('✅ GameController: Updating game state immediately from API result');
      this.gameStore.handleGameStateUpdate(result.gameState);
    }
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
      turnTimerStore.stopTimer();

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
   */
  async purchaseUpgrade(regionIndex: number, upgradeIndex: number): Promise<void> {
    try {
      const data = await this.apiClient.purchaseUpgrade(this.playerId, regionIndex, upgradeIndex);

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
   * End turn
   */
  async endTurn(): Promise<void> {
    // Stop the timer when ending turn
    turnTimerStore.stopTimer();

    try {
      await this.apiClient.endTurn(this.playerId);

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
    const playerSlotIndex = parseInt(this.playerId);

    console.log('📖 GameController.updateTooltips called', {
      hasGameState: !!gameState,
      hasRegions: !!regions,
      regionsCount: regions?.length,
      moveState: currentMoveState
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

    const isMyTurn = gameState.currentPlayerSlot === playerSlotIndex;
    const selectedRegionIndex = currentMoveState?.sourceRegion ?? null;

    console.log('📖 GameController tooltip params:', {
      playerSlotIndex,
      currentPlayerSlot: gameState.currentPlayerSlot,
      isMyTurn,
      selectedRegionIndex,
      mode: currentMoveState?.mode
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

    console.log('📖 GameController setting tooltips:', tooltips);
    this.tutorialTips.set(tooltips);
  }

  /**
   * Dismiss a tutorial tooltip
   */
  dismissTooltip(tooltipId: string): void {
    this.tutorialManager.dismissTooltip(tooltipId);
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
      tutorialTips: this.tutorialTips
    };
  }
}


