import type { Writable } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import type { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { GameStateData, Player, Region } from '$lib/game/entities/gameTypes';
import { PlayerEliminationService } from '$lib/game/mechanics/PlayerEliminationService';
import { clearBattleState } from '$lib/game/utils/GameStateUtils';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';

/**
 * Manages WebSocket game state updates with proper queuing and orchestration.
 *
 * Handles the complex flow of:
 * - Queuing multiple rapid updates
 * - Turn transition detection and banner coordination
 * - Elimination detection and banner display
 * - Move replay for other players' actions (timing handled by MoveReplayer)
 * - Audio feedback
 */
export class GameStateUpdater {
  private updateQueue: any[] = [];
  private isProcessingUpdate = false;
  private lastRawState: GameStateData | null = null; // Track raw state without overrides
  private onTurnReadyCallback: ((gameState: GameStateData) => void) | null = null;
  private isBattleInProgressCallback: (() => boolean) | null = null;
  private triggerAiProcessingCallback: (() => Promise<void>) | null = null;
  private static isReplayingMoves = false; // Global flag to prevent state contamination during AI replay

  constructor(
    private gameStateStore: Writable<GameStateData | null>,
    private regionsStore: Writable<Region[]>,
    private playersStore: Writable<Player[]>,
    private eliminationBannersStore: Writable<number[]>,
    private playerSlotIndex: number,
    private getMoveSystem: () => MoveSystem | null,
    private moveReplayer: MoveReplayer,
    private showEliminationBanner: (playerSlotIndex: number) => void
  ) {}

  /**
   * Initialize with the initial game state (call after loading from server)
   */
  initializeWithState(initialState: GameStateData): void {
    this.lastRawState = clearBattleState(initialState);
    console.log('📍 GameStateUpdater: Initialized with initial state', {
      currentPlayerSlot: initialState.currentPlayerSlot,
      turnNumber: initialState.turnNumber
    });
  }

  /**
   * Set callback to be called when player's turn is ready for interaction
   */
  setOnTurnReadyCallback(callback: (gameState: GameStateData) => void): void {
    this.onTurnReadyCallback = callback;
  }

  /**
   * Set callback to check if a battle is currently in progress
   */
  setIsBattleInProgressCallback(callback: () => boolean): void {
    this.isBattleInProgressCallback = callback;
  }

  /**
   * Set callback to trigger AI processing when turn changes to AI player
   */
  setTriggerAiProcessingCallback(callback: () => Promise<void>): void {
    this.triggerAiProcessingCallback = callback;
  }

  /**
   * Check for player eliminations and show banners immediately
   */
  private checkForEliminations(gameState: GameStateData): void {
    const eliminatedPlayers = PlayerEliminationService.checkForEliminations(gameState);

    if (eliminatedPlayers.length > 0) {
      console.log('💀 Eliminated players detected:', {
        eliminatedPlayers,
        turnNumber: gameState.turnNumber,
        allPlayers: gameState.players?.map(p => ({ name: p.name, slot: p.slotIndex })),
        ownersByRegion: gameState.ownersByRegion
      });
    }

    // Show elimination banners for each eliminated player
    for (const playerSlotIndex of eliminatedPlayers) {
      this.showEliminationBanner(playerSlotIndex);
    }
  }

  /**
   * Handle WebSocket game state updates
   * Updates are queued to ensure banners complete before next update
   */
  handleGameStateUpdate(updatedState: any) {
    console.log('🎮 Received game update via WebSocket:', updatedState);

    // Add to queue
    this.updateQueue.push(updatedState);

    // Start processing if not already processing
    if (!this.isProcessingUpdate) {
      this.processNextUpdate();
    }
  }


  /**
   * Process queued updates one at a time
   * 
   * Banner sequencing for multiplayer:
   * 1. When receiving another player's moves, show THEIR banner first
   * 2. Replay their moves
   * 3. Only when it's OUR turn, show OUR "your turn" banner
   */
  private async processNextUpdate() {
    if (this.updateQueue.length === 0) {
      this.isProcessingUpdate = false;
      return;
    }

    // Wait for initialization before processing updates
    if (!this.lastRawState) {
      console.log('⏸️ Waiting for initialization before processing WebSocket update...');
      setTimeout(() => this.processNextUpdate(), 100);
      return;
    }

    // Wait if a battle is in progress
    if (this.isBattleInProgressCallback && this.isBattleInProgressCallback()) {
      console.log('⏸️ Battle in progress, delaying WebSocket update...');
      // Retry after a short delay
      setTimeout(() => this.processNextUpdate(), 100);
      return;
    }

    this.isProcessingUpdate = true;
    const updatedState = this.updateQueue.shift();

    // Use lastRawState for comparison (not the display state which might have overrides)
    const currentState = this.lastRawState;

    // Ensure battle states are cleared from server updates
    const cleanState = clearBattleState(updatedState);

    // Check if turn changed (either player changed OR turn number increased, indicating a full round)
    const playerChanged = currentState && updatedState.currentPlayerSlot !== currentState.currentPlayerSlot;
    const turnNumberIncreased = currentState && updatedState.turnNumber > currentState.turnNumber;
    const isNewTurn = playerChanged || turnNumberIncreased;

    // Detect if this was another player's move by checking who had the turn BEFORE (in currentState)
    // If the previous player was someone else, we should animate their move
    const previousPlayerSlot = currentState?.currentPlayerSlot;
    const wasPreviousPlayerSomeoneElse = previousPlayerSlot !== undefined && previousPlayerSlot !== this.playerSlotIndex;
    const isOtherPlayerMove = wasPreviousPlayerSomeoneElse;

    // Check if the turn is now transitioning to the local player
    const isNowMyTurn = cleanState.currentPlayerSlot === this.playerSlotIndex;

    console.log('🔍 Move detection:', {
      mySlotIndex: this.playerSlotIndex,
      previousPlayerSlot,
      currentPlayerSlot: updatedState.currentPlayerSlot,
      isNewTurn,
      isOtherPlayerMove,
      isNowMyTurn
    });

    // Update players store early so TurnManager can use updated list
    this.playersStore.set(cleanState.players || []);

    // Check for eliminations in the updated state (e.g., from AI moves)
    this.checkForEliminations(cleanState);

    // Check if game has ended BEFORE processing turn transition
    const gameEndResult = checkGameEnd(cleanState, cleanState.players || []);
    if (gameEndResult.isGameEnded) {
      console.log('🏁 Game ended detected in state update, setting endResult immediately');
      cleanState.endResult = gameEndResult.winner;
      // Don't show turn banner if game has ended - apply state immediately
      this.gameStateStore.set(cleanState);
      this.regionsStore.set(cleanState.regions || []);
      this.playersStore.set(cleanState.players || []);
      this.lastRawState = cleanState;
      this.isProcessingUpdate = false;
      this.processNextUpdate();
      return;
    }

    // Handle other player's moves - show THEIR banner before replaying moves
    if (isOtherPlayerMove && previousPlayerSlot !== undefined) {
      console.log(`🔄 Processing move from player slot ${previousPlayerSlot}`);

      // Show replay banner for the player who made the move (before replaying)
      // TurnManager will only show if different from last shown banner
      await turnManager.showReplayBannerForPlayer(previousPlayerSlot);

      // Set flag to prevent animation states from contaminating game state
      GameStateUpdater.isReplayingMoves = true;

      // Detect and replay moves using state comparison
      console.log('📼 Detecting and replaying moves from state diff');
      await this.moveReplayer.replayMoves(updatedState, currentState);

      // Clear flag before applying final state
      GameStateUpdater.isReplayingMoves = false;

      console.log('✅ Animations complete for other player\'s move');

      // Update game state after replay
      turnManager.updateGameState(cleanState);

      // Update lastRawState to prevent infinite loop
      this.lastRawState = cleanState;

      // Apply the final state after animations complete
      this.gameStateStore.set(cleanState);
      this.regionsStore.set(cleanState.regions || []);
      this.playersStore.set(cleanState.players || []);

      // If turn changed to local player, show "your turn" banner
      if (isNewTurn && isNowMyTurn) {
        console.log('🎯 Turn is now mine - clearing replay tracking and showing my turn banner');
        
        // Clear replay banner tracking so next round of replays will show correctly
        turnManager.clearReplayBannerTracking();

        // Show "your turn" banner
        await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);
        
        // Update UI state
        this.gameStateStore.update(state => state ? {
          ...state,
          currentPlayerSlot: cleanState.currentPlayerSlot,
          turnNumber: cleanState.turnNumber
        } : state);

        audioSystem.playSound(SOUNDS.GAME_STARTED);

        // Wait for banner to complete
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
        });

        // Ensure the turn transition is complete and highlighting is enabled
        turnManager.onBannerComplete();
        turnManager.enableHighlighting();

        // Notify that our turn is ready for interaction
        if (this.onTurnReadyCallback) {
          console.log('⏰ Turn is ready - notifying callback');
          this.onTurnReadyCallback(cleanState);
        }
      } else if (isNewTurn) {
        // Turn changed to another player (not us) - check if AI
        const currentPlayer = cleanState.players.find(p => p.slotIndex === cleanState.currentPlayerSlot);
        const isAiPlayer = currentPlayer?.isAI;

        // IMPORTANT: Update TurnManager's slot tracking so next transitionToPlayer works correctly
        turnManager.updatePlayerSlotTracking(cleanState.currentPlayerSlot);

        // Update currentPlayerSlot for UI
        this.gameStateStore.update(state => state ? {
          ...state,
          currentPlayerSlot: cleanState.currentPlayerSlot,
          turnNumber: cleanState.turnNumber
        } : state);

        // If the new current player is AI, trigger AI processing
        if (isAiPlayer && this.triggerAiProcessingCallback) {
          console.log('🤖 Turn changed to AI player, triggering AI processing');
          // Don't await - let it run in background
          this.triggerAiProcessingCallback().catch(error => {
            console.error('❌ Error triggering AI processing:', error);
          });
        }
      }
    } else if (isNewTurn && isNowMyTurn) {
      // Turn changed directly to us (no other player moves to replay)
      console.log('🎯 Turn transition directly to me');
      
      // Clear any previous replay banner tracking
      turnManager.clearReplayBannerTracking();

      await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);

      // Update UI state
      this.gameStateStore.update(state => state ? {
        ...state,
        currentPlayerSlot: cleanState.currentPlayerSlot,
        turnNumber: cleanState.turnNumber
      } : state);

      audioSystem.playSound(SOUNDS.GAME_STARTED);

      // Wait for banner to complete
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
      });

      // Ensure the turn transition is complete and highlighting is enabled
      turnManager.onBannerComplete();
      turnManager.enableHighlighting();

      // Update lastRawState to prevent infinite loop
      this.lastRawState = cleanState;

      // Apply state after banner
      this.gameStateStore.set(cleanState);
      this.regionsStore.set(cleanState.regions || []);
      this.playersStore.set(cleanState.players || []);

      // Notify that our turn is ready for interaction
      if (this.onTurnReadyCallback) {
        console.log('⏰ Turn is ready - notifying callback');
        this.onTurnReadyCallback(cleanState);
      }
    } else if (isNewTurn) {
      // Turn changed to another player (not triggered by other player move)
      // This happens when the local player ends their turn
      console.log('🔄 Turn transition to another player (slot:', cleanState.currentPlayerSlot, ')');
      
      turnManager.updateGameState(cleanState);

      // IMPORTANT: Update TurnManager's slot tracking so next transitionToPlayer works correctly
      turnManager.updatePlayerSlotTracking(cleanState.currentPlayerSlot);

      // Update UI state
      this.gameStateStore.update(state => state ? {
        ...state,
        currentPlayerSlot: cleanState.currentPlayerSlot,
        turnNumber: cleanState.turnNumber
      } : state);

      // Update lastRawState to prevent infinite loop
      this.lastRawState = cleanState;

      // Apply state
      this.gameStateStore.set(cleanState);
      this.regionsStore.set(cleanState.regions || []);
      this.playersStore.set(cleanState.players || []);

      // Check if the new current player is AI
      const currentPlayer = cleanState.players.find(p => p.slotIndex === cleanState.currentPlayerSlot);
      const isAiPlayer = currentPlayer?.isAI;

      if (isAiPlayer && this.triggerAiProcessingCallback) {
        console.log('🤖 Turn changed to AI player, triggering AI processing');
        this.triggerAiProcessingCallback().catch(error => {
          console.error('❌ Error triggering AI processing:', error);
        });
      }
    } else {
      // Same player slot, our own move - BattleManager already animated it
      console.log('✅ Applying update for our own move (already animated by BattleManager)');
      turnManager.updateGameState(cleanState);

      // Update lastRawState to prevent infinite loop
      this.lastRawState = cleanState;

      this.gameStateStore.set(cleanState);
      this.regionsStore.set(cleanState.regions || []);
      this.playersStore.set(cleanState.players || []);
    }

    const moveSystem = this.getMoveSystem();
    if (moveSystem) {
      moveSystem.updateGameState(cleanState);
    }

    // Store raw state for NEXT comparison (after we've used currentState for this update)
    this.lastRawState = cleanState;

    // Process next update in queue
    this.processNextUpdate();
  }

  /**
   * Check if we're currently replaying AI moves
   * Used to prevent animation states from contaminating game state
   */
  static isCurrentlyReplayingMoves(): boolean {
    return GameStateUpdater.isReplayingMoves;
  }
}
