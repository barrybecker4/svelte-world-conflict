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
import { logger } from 'multiplayer-framework/shared';

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
  private updateQueue: GameStateData[] = [];
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
  ) { }

  /**
   * Initialize with the initial game state (call after loading from server)
   */
  initializeWithState(initialState: GameStateData): void {
    this.lastRawState = clearBattleState(initialState);
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

    // Show elimination banners for each eliminated player
    for (const playerSlotIndex of eliminatedPlayers) {
      this.showEliminationBanner(playerSlotIndex);
    }
  }

  /**
   * Apply game state to all stores
   */
  private applyStateToStores(cleanState: GameStateData): void {
    this.gameStateStore.set(cleanState);
    this.regionsStore.set(cleanState.regions || []);
    this.playersStore.set(cleanState.players || []);
  }

  /**
   * Update UI state with current player slot and turn number
   */
  private updateUiState(cleanState: GameStateData): void {
    this.gameStateStore.update(state => state ? {
      ...state,
      currentPlayerSlot: cleanState.currentPlayerSlot,
      turnNumber: cleanState.turnNumber
    } : state);
  }

  /**
   * Show "your turn" banner and wait for it to complete
   */
  private async showMyTurnBanner(cleanState: GameStateData): Promise<void> {
    turnManager.clearReplayBannerTracking();
    await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);
    this.updateUiState(cleanState);
    audioSystem.playSound(SOUNDS.GAME_STARTED);

    // Wait for banner to complete
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
    });

    turnManager.onBannerComplete();
    turnManager.enableHighlighting();

    if (this.onTurnReadyCallback) {
      this.onTurnReadyCallback(cleanState);
    }
  }

  /**
   * Trigger AI processing if the current player is AI
   */
  private triggerAiIfNeeded(cleanState: GameStateData): void {
    const currentPlayer = cleanState.players.find(p => p.slotIndex === cleanState.currentPlayerSlot);
    const isAiPlayer = currentPlayer?.isAI;

    if (isAiPlayer && this.triggerAiProcessingCallback) {
      this.triggerAiProcessingCallback().catch(error => {
        logger.error('Error triggering AI processing:', error);
      });
    }
  }

  /**
   * Handle other player's move with replay and optional turn transition
   */
  private async handleOtherPlayerMove(
    cleanState: GameStateData,
    updatedState: GameStateData,
    currentState: GameStateData,
    previousPlayerSlot: number,
    isNewTurn: boolean,
    isNowMyTurn: boolean
  ): Promise<void> {
    // Show replay banner for the player who made the move
    await turnManager.showReplayBannerForPlayer(previousPlayerSlot);

    // Set flag to prevent animation states from contaminating game state
    GameStateUpdater.isReplayingMoves = true;
    await this.moveReplayer.replayMoves(updatedState, currentState);
    GameStateUpdater.isReplayingMoves = false;

    turnManager.updateGameState(cleanState);
    this.lastRawState = cleanState;
    this.applyStateToStores(cleanState);

    if (isNewTurn && isNowMyTurn) {
      await this.showMyTurnBanner(cleanState);
    } else if (isNewTurn) {
      turnManager.updatePlayerSlotTracking(cleanState.currentPlayerSlot);
      this.updateUiState(cleanState);
      this.triggerAiIfNeeded(cleanState);
    }
  }

  /**
   * Handle direct turn transition to local player (no other player moves to replay)
   */
  private async handleDirectTurnTransitionToMe(cleanState: GameStateData): Promise<void> {
    await this.showMyTurnBanner(cleanState);
    this.lastRawState = cleanState;
    this.applyStateToStores(cleanState);
  }

  /**
   * Handle turn transition to another player (when local player ends turn)
   */
  private handleTurnTransitionToOtherPlayer(cleanState: GameStateData): void {
    turnManager.updateGameState(cleanState);
    turnManager.updatePlayerSlotTracking(cleanState.currentPlayerSlot);
    this.updateUiState(cleanState);
    this.lastRawState = cleanState;
    this.applyStateToStores(cleanState);
    this.triggerAiIfNeeded(cleanState);
  }

  /**
   * Handle local player's own move (already animated by BattleManager)
   */
  private handleLocalPlayerMove(cleanState: GameStateData): void {
    turnManager.updateGameState(cleanState);
    this.lastRawState = cleanState;
    this.applyStateToStores(cleanState);
  }

  /**
   * Handle WebSocket game state updates
   * Updates are queued to ensure banners complete before next update
   */
  handleGameStateUpdate(updatedState: GameStateData) {
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
      setTimeout(() => this.processNextUpdate(), 100);
      return;
    }

    // Wait if a battle is in progress
    if (this.isBattleInProgressCallback && this.isBattleInProgressCallback()) {
      // Retry after a short delay
      setTimeout(() => this.processNextUpdate(), 100);
      return;
    }

    this.isProcessingUpdate = true;
    const updatedState = this.updateQueue.shift();

    // Guard against undefined state
    if (!updatedState) {
      this.isProcessingUpdate = false;
      this.processNextUpdate();
      return;
    }

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
    const isOtherPlayerMove = previousPlayerSlot !== undefined && previousPlayerSlot !== this.playerSlotIndex;

    // Check if the turn is now transitioning to the local player
    const isNowMyTurn = cleanState.currentPlayerSlot === this.playerSlotIndex;

    // Update players store early so TurnManager can use updated list
    this.playersStore.set(cleanState.players || []);

    // Check for eliminations in the updated state (e.g., from AI moves)
    this.checkForEliminations(cleanState);

    // Check if game has ended BEFORE processing turn transition
    const gameEndResult = checkGameEnd(cleanState, cleanState.players || []);
    if (gameEndResult.isGameEnded) {
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
      await this.handleOtherPlayerMove(cleanState, updatedState, currentState, previousPlayerSlot, isNewTurn, isNowMyTurn);
    } else if (isNewTurn && isNowMyTurn) {
      await this.handleDirectTurnTransitionToMe(cleanState);
    } else if (isNewTurn) {
      this.handleTurnTransitionToOtherPlayer(cleanState);
    } else {
      this.handleLocalPlayerMove(cleanState);
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
