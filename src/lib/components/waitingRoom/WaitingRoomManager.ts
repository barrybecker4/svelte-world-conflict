import { writable, type Writable } from 'svelte/store';
import { countOpenSlots, countActivePlayers, countTotalActiveSlots } from '$lib/client/slots/slotUtils';

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
  private pollInterval: NodeJS.Timeout | null = null;
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
    this.startPolling();
  }

  async loadGameState() {
    try {
      this.loading.set(true);
      const response = await fetch(`/api/game/${this.gameId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const gameData = await response.json();
      console.log('📊 Game state loaded:', {
        status: gameData.status,
        players: gameData.players?.length
      });

      // Check if game has started
      if (gameData.status === 'ACTIVE') {
        console.log('🎮 Game is now ACTIVE - triggering gameStarted');
        this.onGameStarted?.();
      }

      this.game.set(gameData);
      this.error.set(null);
    } catch (err) {
      console.error('❌ Error loading game state:', err);
      this.error.set('Network error loading game');
      setTimeout(() => this.error.set(null), 3000);
    } finally {
      this.loading.set(false);
    }
  }

  private async setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;

    try {
      const { multiplayerActions, gameUpdates, multiplayerState } = await import('$lib/client/stores/multiplayerStore');

      // Monitor connection state
      this.wsStateUnsubscribe = multiplayerState.subscribe(state => {
        this.wsConnected.set(state.isConnected);
        if (state.lastError) {
          console.error(`WebSocket error: ${state.lastError}`);
        }
      });

      // Connect to WebSocket for this game
      await multiplayerActions.connectToGame(this.gameId);
      console.log(`🔌 Connected to WebSocket for game ${this.gameId}`);

      // Subscribe to game updates
      this.wsUnsubscribe = gameUpdates.subscribe(update => {
        if (update && update.gameId === this.gameId) {
          console.log(`📨 Real-time update:`, update.type);

          if (update.type === 'playerJoined' || update.type === 'gameUpdate') {
            this.loadGameState();
          } else if (update.type === 'gameStarted') {
            console.log('🚀 Game auto-started - all slots filled');
            // Game has started, trigger callback if provided
            this.onGameStarted?.();
          }
        }
      });
    } catch (error) {
      console.log('Real-time updates not available:', error.message);
      this.wsConnected.set(false);
    }
  }

  private startPolling() {
    // Fallback polling if WebSocket fails
    this.pollInterval = setInterval(() => {
      let connected = false;
      const unsubscribe = this.wsConnected.subscribe(value => connected = value);
      unsubscribe();

      if (!connected) {
        this.loadGameState();
      }
    }, 5000);
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

  getOpenSlotsCount(game: any): number {
    return countOpenSlots(game);
  }

  getActivePlayersCount(game: any): number {
    return countActivePlayers(game);
  }

  getTotalActiveSlots(game: any): number {
    return countTotalActiveSlots(game);
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
        const errorData = await response.json();
        this.error.set(errorData.error || 'Failed to start game');
        setTimeout(() => this.error.set(null), 3000);
      }
    } catch (err) {
      this.error.set('Network error starting game');
      setTimeout(() => this.error.set(null), 3000);
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
        const errorData = await response.json();
        this.error.set(errorData.error || 'Failed to leave game');
        setTimeout(() => this.error.set(null), 3000);
      }
    } catch (err) {
      console.error('❌ Error leaving game:', err);
      this.error.set('Network error leaving game');
      setTimeout(() => this.error.set(null), 3000);
    }
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

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