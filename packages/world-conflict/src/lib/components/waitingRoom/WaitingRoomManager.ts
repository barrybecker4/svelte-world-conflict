import { writable, type Writable } from 'svelte/store';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

export interface WaitingRoomSlotInfo {
  type: 'open' | 'creator' | 'taken' | 'ai' | 'disabled';
  name: string;
  color: string;
  isCurrentPlayer?: boolean;
}

export class WaitingRoomManager {
  public game: Writable<any> = writable(null);
  public loading: Writable<boolean> = writable(true);
  public error: Writable<string | null> = writable(null);
  public wsConnected: Writable<boolean> = writable(false);

  private gameId: string;
  private currentPlayerId: number | null = null;
  private wsClient: any = null;
  private wsUnsubscribe: (() => void) | null = null;
  private wsStateUnsubscribe: (() => void) | null = null;
  private onGameStarted: (() => void) | null = null;

  constructor(gameId: string, currentPlayerId: number | null) {
    this.gameId = gameId;
    this.currentPlayerId = currentPlayerId;
  }

  async initialize(initialGame: any = null, onGameStarted?: () => void) {
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
      const response = await fetch(`/api/game/${this.gameId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const gameData = await response.json() as any;
      if (gameData.status === 'ACTIVE') {
        console.log('🎮 Game is now ACTIVE - triggering gameStarted');
        this.onGameStarted?.();
      }

      this.game.set(gameData);
      this.error.set(null);
    } catch (err) {
      console.error('❌ Error loading game state:', err);
      this.error.set('Network error loading game');
      setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
    } finally {
      this.loading.set(false);
    }
  }

  private async setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;

    try {
      // Import GameWebSocketClient
      const { GameWebSocketClient } = await import('$lib/client/websocket/GameWebSocketClient');

      // Create WebSocket client instance with playerId for disconnect tracking
      const playerIdStr = this.currentPlayerId !== null ? this.currentPlayerId.toString() : undefined;
      this.wsClient = new GameWebSocketClient(playerIdStr);
      console.log(`🔌 Setting up WebSocket connection for game ${this.gameId} (playerId: ${playerIdStr || 'none'})`);

      // Monitor connection state
      this.wsStateUnsubscribe = this.wsClient.connected.subscribe((isConnected: boolean) => {
        this.wsConnected.set(isConnected);
        console.log(`🔌 WebSocket connection state: ${isConnected ? 'connected' : 'disconnected'}`);
      });

      // Register callbacks for WebSocket events
      this.wsClient.onGameStarted((data: any) => {
        console.log('🚀 [WaitingRoom] Received gameStarted WebSocket message', data);
        // Don't disconnect here - the game screen will establish its own connection
        // This waiting room connection will be cleaned up when the component unmounts
        // The server ignores disconnects within a few seconds of game start to prevent false eliminations
        console.log('🚀 [WaitingRoom] Triggering onGameStarted callback');
        this.onGameStarted?.();
      });

      this.wsClient.onPlayerJoined((data: any) => {
        console.log(`📨 [WaitingRoom] Received playerJoined WebSocket message:`, data);
        // Reload game state to show updated player list
        this.loadGameState();
      });

      this.wsClient.onGameUpdate((data: any) => {
        console.log(`📨 [WaitingRoom] Received gameUpdate WebSocket message:`, data);
        // Check if game has started (transitioned from PENDING to ACTIVE)
        if (data.status === 'ACTIVE') {
          console.log('🎮 [WaitingRoom] Game transitioned to ACTIVE via gameUpdate (keeping WebSocket connected)');
          this.onGameStarted?.();
        } else {
          // Just update the game state (e.g. player list changes)
          this.loadGameState();
        }
      });

      // Track if we've been subscribed
      let hasSubscribed = false;

      this.wsClient.onConnected(() => {
        console.log(`✅ [WaitingRoom] WebSocket connected for game ${this.gameId}, waiting for subscription confirmation...`);
      });

      // Listen for subscription confirmation
      this.wsClient.on('subscribed', (message: any) => {
        hasSubscribed = true;
        const subscribedGameId = message.gameId || message;
        console.log(`✅ [WaitingRoom] Successfully subscribed to game ${subscribedGameId}`);
        if (subscribedGameId !== this.gameId) {
          console.error(`❌ [WaitingRoom] Subscription game ID mismatch! Expected ${this.gameId}, got ${subscribedGameId}`);
          this.error.set(`Subscription error: wrong game ID`);
        }
      });

      this.wsClient.onDisconnected(() => {
        console.error(`❌ [WaitingRoom] WebSocket DISCONNECTED from game ${this.gameId} - this means we won't receive gameStarted notifications!`);
        this.error.set('Connection lost. Please refresh the page.');
      });

      this.wsClient.onError((error: string) => {
        console.error(`❌ [WaitingRoom] WebSocket error for game ${this.gameId}:`, error);
        this.error.set(`Connection error: ${error}`);
      });

      // Connect to the WebSocket for this game
      console.log(`🔌 [WaitingRoom] Attempting to connect WebSocket for game ${this.gameId}...`);
      await this.wsClient.connect(this.gameId);
      console.log(`🔌 [WaitingRoom] WebSocket connect() call completed for game ${this.gameId}`);
    } catch (error: any) {
      console.error('❌ Error setting up real-time updates:', error);
      this.wsConnected.set(false);
    }
  }

  getSlotInfo(game: any, slotIndex: number, getPlayerConfig: (index: number) => any): WaitingRoomSlotInfo {
    if (game?.pendingConfiguration?.playerSlots) {
      const slot = game.pendingConfiguration.playerSlots[slotIndex];

      if (!slot || slot.type === 'Off') {
        return { type: 'disabled', name: 'Disabled', color: '#6b7280' };
      }

      if (slot.type === 'Set') {
        return { type: 'creator', name: slot.name, color: '#3b82f6' };
      }

      if (slot.type === 'AI') {
        return { type: 'ai', name: slot.name, color: '#8b5cf6' };
      }

      if (slot.type === 'Open') {
        const player = game.players?.find(p => p.slotIndex === slotIndex);
        if (player) {
          return {
            type: 'taken',
            name: player.name,
            color: getPlayerConfig(slotIndex).color,
            isCurrentPlayer: this.currentPlayerId === slotIndex
          };
        }
        return { type: 'open', name: 'Waiting...', color: '#10b981' };
      }
    }

    const player = game?.players?.find(p => p.slotIndex === slotIndex);
    if (player) {
      return {
        type: 'taken',
        name: player.name,
        color: getPlayerConfig(slotIndex).color,
        isCurrentPlayer: this.currentPlayerId === slotIndex
      };
    }
    return { type: 'open', name: 'Waiting...', color: '#10b981' };
  }

  async startGame(onSuccess: () => void) {
    try {
      console.log('🚀 Starting game...');
      const response = await fetch(`/api/game/${this.gameId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('✅ Game started successfully');

        const { audioSystem } = await import('$lib/client/audio/AudioSystem');
        const { SOUNDS } = await import('$lib/client/audio/sounds');
        await audioSystem.playSound(SOUNDS.GAME_STARTED);

        onSuccess();
      } else {
        const errorData = await response.json() as { error?: string };
        this.error.set(errorData.error || 'Failed to start game');
        setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
      }
    } catch (err) {
      this.error.set('Network error starting game');
      setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
    }
  }

  async leaveGame(onSuccess: () => void) {
    try {
      console.log('🚪 Leaving game...');
      const response = await fetch(`/api/game/${this.gameId}/quit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.currentPlayerId?.toString()
        })
      });

      if (response.ok) {
        const { removeGameCreator } = await import('$lib/client/stores/clientStorage');
        removeGameCreator(this.gameId);
        console.log('✅ Successfully left game');
        onSuccess();
      } else {
        const errorData = await response.json() as { error?: string };
        this.error.set(errorData.error || 'Failed to leave game');
        setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
      }
    } catch (err) {
      console.error('❌ Error leaving game:', err);
      this.error.set('Network error leaving game');
      setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
    }
  }

  destroy() {
    console.log('🧹 Cleaning up WaitingRoomManager');

    // Disconnect WebSocket client
    if (this.wsClient) {
      console.log('🔌 Disconnecting WebSocket client');
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
