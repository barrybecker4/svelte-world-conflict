import { writable, type Writable } from 'svelte/store';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';
import { getSlotInfoFromGame, type BaseSlotInfo } from '$lib/client/slots/slotUtils';
import { GameApiClient } from '$lib/client/gameController/GameApiClient';
import type { PendingGameData } from '$lib/game/entities/gameTypes';

export interface WaitingRoomSlotInfo extends BaseSlotInfo {
  color: string;
}

export class WaitingRoomManager {
  public game: Writable<PendingGameData | null> = writable(null);
  public loading: Writable<boolean> = writable(true);
  public error: Writable<string | null> = writable(null);
  public wsConnected: Writable<boolean> = writable(false);

  private gameId: string;
  private apiClient: GameApiClient;
  private currentPlayerId: number | null = null;
  private wsClient: any = null;
  private wsUnsubscribe: (() => void) | null = null;
  private wsStateUnsubscribe: (() => void) | null = null;
  private onGameStarted: (() => void) | null = null;

  constructor(gameId: string, currentPlayerId: number | null) {
    this.gameId = gameId;
    this.apiClient = new GameApiClient(gameId);
    this.currentPlayerId = currentPlayerId;
  }

  /**
   * Sets an error message that automatically clears after timeout
   */
  private setTemporaryError(message: string) {
    this.error.set(message);
    setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
  }

  async initialize(initialGame: PendingGameData | null = null, onGameStarted?: () => void) {
    this.onGameStarted = onGameStarted || null;

    if (initialGame) {
      this.game.set(initialGame);
      this.loading.set(false);
    } else {
      await this.loadGameState();
    }

    await this.setupRealtimeUpdates();
  }

  async loadGameState() {
    try {
      this.loading.set(true);
      const gameData = await this.apiClient.getGameState();

      if (gameData.status === 'ACTIVE') {
        logger.debug('Game is now ACTIVE - triggering gameStarted');
        this.onGameStarted?.();
      }

      this.game.set(gameData as PendingGameData);
      this.error.set(null);
    } catch (err) {
      logger.error('Error loading game state:', err);
      this.setTemporaryError('Network error loading game');
    } finally {
      this.loading.set(false);
    }
  }

  // WebSocket callback handlers
  private handleGameStarted = (data: any) => {
    logger.debug('[WaitingRoom] Received gameStarted WebSocket message', data);
    // Don't disconnect here - the game screen will establish its own connection
    // This waiting room connection will be cleaned up when the component unmounts
    // The server ignores disconnects within a few seconds of game start to prevent false eliminations
    logger.debug('[WaitingRoom] Triggering onGameStarted callback');
    this.onGameStarted?.();
  };

  private handlePlayerJoined = (data: any) => {
    logger.debug(`[WaitingRoom] Received playerJoined WebSocket message:`, data);
    // Reload game state to show updated player list
    this.loadGameState();
  };

  private handleGameUpdate = (data: any) => {
    logger.debug(`[WaitingRoom] Received gameUpdate WebSocket message:`, data);
    // Check if game has started (transitioned from PENDING to ACTIVE)
    if (data.status === 'ACTIVE') {
      logger.debug('[WaitingRoom] Game transitioned to ACTIVE via gameUpdate (keeping WebSocket connected)');
      this.onGameStarted?.();
    } else {
      // Just update the game state (e.g. player list changes)
      this.loadGameState();
    }
  };

  private handleSubscribed = (message: any) => {
    const subscribedGameId = message.gameId || message;
    logger.debug(`[WaitingRoom] Successfully subscribed to game ${subscribedGameId}`);
    if (subscribedGameId !== this.gameId) {
      logger.error(`[WaitingRoom] Subscription game ID mismatch! Expected ${this.gameId}, got ${subscribedGameId}`);
      this.error.set(`Subscription error: wrong game ID`);
    }
  };

  private handleDisconnected = () => {
    logger.error(`[WaitingRoom] WebSocket DISCONNECTED from game ${this.gameId} - this means we won't receive gameStarted notifications!`);
    this.error.set('Connection lost. Please refresh the page.');
  };

  private handleError = (error: string) => {
    logger.error(`[WaitingRoom] WebSocket error for game ${this.gameId}:`, error);
    this.error.set(`Connection error: ${error}`);
  };

  private async setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;

    try {
      // Import GameWebSocketClient
      const { GameWebSocketClient } = await import('$lib/client/websocket/GameWebSocketClient');

      // Create WebSocket client instance with playerId for disconnect tracking
      const playerIdStr = this.currentPlayerId !== null ? this.currentPlayerId.toString() : undefined;
      this.wsClient = new GameWebSocketClient(playerIdStr);
      logger.debug(`Setting up WebSocket connection for game ${this.gameId} (playerId: ${playerIdStr || 'none'})`);

      // Monitor connection state
      this.wsStateUnsubscribe = this.wsClient.onConnectionChange((isConnected: boolean) => {
        this.wsConnected.set(isConnected);
        logger.debug(`WebSocket connection state: ${isConnected ? 'connected' : 'disconnected'}`);
      });

      // Register callbacks for WebSocket events
      this.wsClient.onGameStarted(this.handleGameStarted);
      this.wsClient.onPlayerJoined(this.handlePlayerJoined);
      this.wsClient.onGameUpdate(this.handleGameUpdate);
      this.wsClient.onConnected(() => {
        logger.debug(`[WaitingRoom] WebSocket connected for game ${this.gameId}, waiting for subscription confirmation...`);
      });
      this.wsClient.on('subscribed', this.handleSubscribed);
      this.wsClient.onDisconnected(this.handleDisconnected);
      this.wsClient.onError(this.handleError);

      // Connect to the WebSocket for this game
      logger.debug(`[WaitingRoom] Attempting to connect WebSocket for game ${this.gameId}...`);
      await this.wsClient.connect(this.gameId);
      logger.debug(`[WaitingRoom] WebSocket connect() call completed for game ${this.gameId}`);
    } catch (error: any) {
      logger.error('Error setting up real-time updates:', error);
      this.wsConnected.set(false);
    }
  }

  getSlotInfo(game: PendingGameData | null, slotIndex: number, getPlayerConfig: (index: number) => { color: string }): WaitingRoomSlotInfo {
    const slotInfo = getSlotInfoFromGame(game, slotIndex, {
      currentPlayerId: this.currentPlayerId,
      getPlayerColor: (idx) => getPlayerConfig(idx).color
    });

    // Customize display name for waiting room context
    if (slotInfo.type === 'open') {
      slotInfo.name = 'Waiting...';
    }

    return slotInfo as WaitingRoomSlotInfo;
  }

  async startGame(onSuccess: () => void) {
    try {
      logger.debug('Starting game...');
      await this.apiClient.startGame();
      
      logger.debug('Game started successfully');

      const { audioSystem } = await import('$lib/client/audio/AudioSystem');
      const { SOUNDS } = await import('$lib/client/audio/sounds');
      await audioSystem.playSound(SOUNDS.GAME_STARTED);

      onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error starting game';
      this.setTemporaryError(errorMessage);
    }
  }

  async leaveGame(onSuccess: () => void) {
    try {
      logger.debug('Leaving game...');
      await this.apiClient.leaveGame(this.currentPlayerId?.toString() || '');
      
      const { removeGameCreator } = await import('$lib/client/stores/clientStorage');
      removeGameCreator(this.gameId);
      logger.debug('Successfully left game');
      onSuccess();
    } catch (err) {
      logger.error('Error leaving game:', err);
      const errorMessage = err instanceof Error ? err.message : 'Network error leaving game';
      this.setTemporaryError(errorMessage);
    }
  }

  destroy() {
    logger.debug('Cleaning up WaitingRoomManager');

    // Disconnect WebSocket client
    if (this.wsClient) {
      logger.debug('Disconnecting WebSocket client');
      this.wsClient.disconnect();
      this.wsClient = null;
    }

    // Clean up subscriptions
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }
    if (this.wsStateUnsubscribe) {
      this.wsStateUnsubscribe();
      this.wsStateUnsubscribe = null;
    }

    this.wsConnected.set(false);
  }
}
