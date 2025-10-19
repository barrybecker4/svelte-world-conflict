import { writable, type Writable } from 'svelte/store';
import { BattleManager } from '$lib/client/rendering/BattleManager';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { useGameWebSocket } from '$lib/client/composables/useGameWebsocket';

interface ModalState {
  showSoldierSelection: boolean;
  showInstructions: boolean;
  showGameSummary: boolean;
  soldierSelectionData: { maxSoldiers: number; currentSelection: number } | null;
  winner: Player | 'DRAWN_GAME' | null;
}

/**
 * Single controller that manages all game logic
 * The component just renders based on this controller's state
 */
export class GameController {
  // Stores
  private modalState: Writable<ModalState>;
  private moveState: Writable<MoveState>;

  // Managers
  private battleManager: BattleManager;
  private websocket: ReturnType<typeof useGameWebSocket>;
  private gameStore: any;

  // State
  private gameEndChecked = false;

  constructor(
    private gameId: string,
    private playerId: string,
    gameStore: any
  ) {
    this.gameStore = gameStore;

    // Initialize stores
    this.modalState = writable({
      showSoldierSelection: false,
      showInstructions: false,
      showGameSummary: false,
      soldierSelectionData: null,
      winner: null
    });

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
      this.gameStore.handleGameStateUpdate(gameData);
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
    await this.gameStore.initializeGame(
      (source: number, target: number, count: number) => this.handleMoveComplete(source, target, count),
      (newState: MoveState) => this.handleMoveStateChange(newState)
    );

    await this.websocket.initialize();
    await audioSystem.enable();
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
    if (newState.mode === 'ADJUST_SOLDIERS' && newState.sourceRegion !== null && newState.targetRegion !== null) {
      console.log('✅ Opening soldier selection modal');
      this.modalState.update(s => ({
        ...s,
        soldierSelectionData: {
          maxSoldiers: newState.maxSoldiers,
          currentSelection: newState.selectedSoldierCount
        },
        showSoldierSelection: true
      }));
    } else {
      this.modalState.update(s => ({
        ...s,
        showSoldierSelection: false,
        soldierSelectionData: null
      }));
    }
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

      // Play sound
      const isWinner =
        endResult.winner !== 'DRAWN_GAME' &&
        endResult.winner?.slotIndex?.toString() === this.playerId;

      audioSystem.playSound(isWinner ? SOUNDS.GAME_WON : SOUNDS.GAME_LOST);

      // Show modal
      this.modalState.update(s => ({
        ...s,
        winner: endResult.winner,
        showGameSummary: true
      }));
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
    this.modalState.update(s => ({
      ...s,
      showSoldierSelection: false,
      soldierSelectionData: null
    }));

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
    this.modalState.update(s => ({
      ...s,
      showSoldierSelection: false,
      soldierSelectionData: null
    }));

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
    console.log(`🏛️ GameController.purchaseUpgrade: region ${regionIndex}, upgrade ${upgradeIndex}`);

    try {
      const response = await fetch(`/api/game/${this.gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          moveType: 'BUILD',
          regionIndex,
          upgradeIndex
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        console.error('❌ Purchase upgrade failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          regionIndex,
          upgradeIndex
        });
        alert('Failed to purchase upgrade: ' + (errorData.error || 'Unknown error'));
        return; // Don't throw, just return to keep panel open
      }

      const data = await response.json() as { gameState?: GameStateData };
      console.log('✅ Upgrade purchased successfully', data);

      // Log the temple data specifically
      if (data.gameState?.templesByRegion?.[regionIndex]) {
        console.log(`🏛️ Server returned temple at region ${regionIndex}:`, data.gameState.templesByRegion[regionIndex]);
      }

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
    console.log('🔚 GameController.endTurn called');

    try {
      const response = await fetch(`/api/game/${this.gameId}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId
        })
      });

      console.log('📡 End turn response:', response.status, response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        console.error('❌ End turn failed:', errorData);
        throw new Error(errorData.error || 'Failed to end turn');
      }

      const result = await response.json() as { success?: boolean; gameState?: any; message?: string };
      console.log('✅ Turn ended successfully:', result);

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
    this.modalState.update(s => ({ ...s, showInstructions: true }));
  }

  closeInstructions(): void {
    this.modalState.update(s => ({ ...s, showInstructions: false }));
  }

  closeGameSummary(): void {
    this.modalState.update(s => ({ ...s, showGameSummary: false }));
  }

  /**
   * Resign from the game
   */
  async resign(): Promise<void> {
    console.log('🏳️ GameController.resign called');

    if (!confirm('Are you sure you want to resign from this game?')) {
      return;
    }

    try {
      const response = await fetch(`/api/game/${this.gameId}/quit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          reason: 'RESIGN'
        })
      });

      console.log('Resign response:', response.status, response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        console.error('❌ Resign failed:', errorData);
        throw new Error(errorData.error || 'Failed to resign from game');
      }

      const result = await response.json() as { gameEnded?: boolean };
      console.log('✅ Resigned successfully:', result);

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
   * Get stores for component binding
   */
  getStores() {
    return {
      modalState: this.modalState,
      moveState: this.moveState,
      isConnected: this.websocket.getConnectedStore()
    };
  }
}
