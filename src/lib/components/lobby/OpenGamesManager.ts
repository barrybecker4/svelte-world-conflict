import { writable, type Writable } from 'svelte/store';

export interface GameSlotInfo {
  type: 'open' | 'creator' | 'taken' | 'ai' | 'disabled';
  name: string;
  canJoin: boolean;
}

export class OpenGamesManager {
  public games: Writable<any[]> = writable([]);
  public loading: Writable<boolean> = writable(true);
  public error: Writable<string | null> = writable(null);
  public wsConnected: Writable<boolean> = writable(false);

  private refreshInterval: NodeJS.Timeout | null = null;
  private wsUnsubscribe: (() => void) | null = null;

  async initialize() {
    await this.loadOpenGames();
    await this.setupRealtimeUpdates();
    this.startAutoRefresh();
  }

  async loadOpenGames() {
    try {
      this.loading.set(true);
      this.error.set(null);

      console.log('🔄 Loading open games...');
      const response = await fetch('/api/games/open');

      if (response.ok) {
        const games = await response.json();
        console.log(`✅ Received ${games.length} games:`, games);
        this.games.set(games.sort((a, b) => b.createdAt - a.createdAt));

        // Return the count for the component to decide what to do
        return games.length;
      } else {
        console.error('❌ Failed to fetch open games:', response.status);
        this.error.set(`Failed to load games: ${response.status}`);
        return 0;
      }
    } catch (err) {
      console.error('❌ Error loading games:', err);
      this.error.set('Failed to connect to server');
      return 0;
    } finally {
      this.loading.set(false);
    }
  }

  async setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;

    try {
      const { multiplayerActions, gameUpdates } = await import('$lib/client/stores/multiplayerStore');

      await multiplayerActions.connectToGame('lobby');
      this.wsConnected.set(true);
      console.log('🔌 Connected to lobby WebSocket');

      this.wsUnsubscribe = gameUpdates.subscribe(update => {
        if (update && (update.type === 'playerJoined' || update.type === 'gameUpdate')) {
          console.log('🔄 Real-time update received, refreshing lobby...');
          this.loadOpenGames();
        }
      });
    } catch (error) {
      console.log('Real-time updates not available:', error.message);
      this.wsConnected.set(false);
    }
  }

  private startAutoRefresh() {
    // Auto-refresh every 10 seconds as backup
    this.refreshInterval = setInterval(() => this.loadOpenGames(), 10000);
  }

  async joinGameInSlot(gameId: string, slotIndex: number) {
    try {
      let playerName;
      try {
        const { getPlayerConfig } = await import('$lib/game/constants/playerConfigs');
        playerName = getPlayerConfig(slotIndex).defaultName;
      } catch (error) {
        const defaultNames = ['Crimson', 'Azure', 'Emerald', 'Golden'];
        playerName = defaultNames[slotIndex] || `Player${slotIndex + 1}`;
      }

      console.log(`Attempting to join game ${gameId} in slot ${slotIndex} as "${playerName}"`);

      const response = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, preferredSlot: slotIndex })
      });

      if (response.ok) {
        const result = await response.json();
        const player = result.player;

        const { goto } = await import('$app/navigation');
        const { saveGameCreator } = await import('$lib/client/stores/clientStorage');

        saveGameCreator(gameId, {
          playerId: player.slotIndex.toString(),
          playerSlotIndex: player.slotIndex,
          playerName: player.name
        });

        console.log(`Successfully joined as player ${player.slotIndex}: ${player.name}`);
        await goto(`/game/${gameId}`);
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Failed to join game';
        console.error('Join game failed:', errorData);
        this.error.set(errorMsg);
        setTimeout(() => this.error.set(null), 3000);
      }
    } catch (err) {
      const errorMsg = 'Network error: ' + err.message;
      console.error('Network error joining game:', err);
      this.error.set(errorMsg);
      setTimeout(() => this.error.set(null), 3000);
    }
  }

  getSlotInfo(game: any, slotIndex: number): GameSlotInfo {
    if (game.pendingConfiguration?.playerSlots) {
      const slot = game.pendingConfiguration.playerSlots[slotIndex];
      if (!slot || slot.type === 'Off') {
        return { type: 'disabled', name: 'Disabled', canJoin: false };
      }
      if (slot.type === 'Set') {
        return { type: 'creator', name: slot.name, canJoin: false };
      }
      if (slot.type === 'AI') {
        return { type: 'ai', name: slot.name, canJoin: false };
      }
      if (slot.type === 'Open') {
        const player = game.players?.find(p => p.slotIndex === slotIndex);
        if (player) {
          return { type: 'taken', name: player.name, canJoin: false };
        }
        return { type: 'open', name: 'Open', canJoin: true };
      }
    }

    const player = game.players?.find(p => p.slotIndex === slotIndex);
    if (player) {
      return { type: 'taken', name: player.name, canJoin: false };
    }
    return { type: 'open', name: 'Open', canJoin: slotIndex < game.maxPlayers };
  }

  getSlotButtonVariant(slotInfo: GameSlotInfo): string {
    switch (slotInfo.type) {
      case 'open': return 'success';
      case 'creator': return 'primary';
      case 'taken': return 'secondary';
      case 'ai': return 'ghost';
      case 'disabled': return 'ghost';
      default: return 'secondary';
    }
  }

  formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }
    
    this.wsConnected.set(false);
  }
}