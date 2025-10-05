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
  async initialize(mapContainer: HTMLElement): Promise<void> {
    this.battleManager.setMapContainer(mapContainer);
    
    // Initialize game store with our callbacks
    await this.gameStore.initializeGame(
      (source: number, target: number, count: number) => this.handleMoveComplete(source, target, count),
      (newState: MoveState) => this.handleMoveStateChange(newState)
    );
    
    await this.websocket.initialize();
    await audioSystem.enable();
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

    // Show soldier selection modal when needed
    if (newState.mode === 'ADJUST_SOLDIERS' && newState.sourceRegion !== null) {
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

    // Handle battle if required
    if (this.battleManager.isBattleRequired(battleMove)) {
      const regions = this.gameStore.regions;
      let currentRegions: any[];
      regions.subscribe((value: any[]) => {
        currentRegions = value;
      })();
      await this.battleManager.executeBattle(battleMove, this.playerId, currentRegions!);
      await audioSystem.playSound(SOUNDS.ATTACK);
    } else {
      await audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);
    }

    // Send move to server
    const response = await fetch(`/api/game/${this.gameId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: this.playerId,
        moveType: 'ARMY_MOVE',
        source: sourceRegionIndex,
        destination: targetRegionIndex,
        count: soldierCount
      })
    });

    if (!response.ok) {
      throw new Error('Move failed');
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
   * Handle soldier count change
   */
  handleSoldierCountChange(count: number): void {
    this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));
    
    const moveSystem = this.gameStore.getMoveSystem();
    moveSystem?.processAction({
      type: 'ADJUST_SOLDIERS',
      payload: { soldierCount: count }
    });
  }

  /**
   * Confirm soldier selection
   */
  confirmSoldierSelection(): void {
    this.modalState.update(s => ({
      ...s,
      showSoldierSelection: false,
      soldierSelectionData: null
    }));
    
    const moveSystem = this.gameStore.getMoveSystem();
    let currentMoveState: MoveState;
    this.moveState.subscribe(s => currentMoveState = s)();
    
    moveSystem?.processAction({
      type: 'ADJUST_SOLDIERS',
      payload: { soldierCount: currentMoveState!.selectedSoldierCount }
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

      const result = await response.json();
      console.log('✅ Turn ended successfully:', result);

      // Reset move state
      this.moveState.set({
        mode: 'IDLE',
        sourceRegion: null,
        targetRegion: null,
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
      isConnected: () => this.websocket.isConnected()
    };
  }
}
