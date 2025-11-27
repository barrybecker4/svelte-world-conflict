import { writable, type Writable } from 'svelte/store';
import {
  getDefaultPlayerName,
  type BaseSlotInfo
} from '$lib/client/slots/slotUtils';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { loadPlayerName, saveGameCreator } from '$lib/client/stores/clientStorage';
import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
import { goto } from '$app/navigation';
import { logger } from '$lib/client/utils/logger';
import type { PlayerSlot } from '$lib/game/entities/PlayerSlot';

export interface OpenGame {
  gameId: string;
  creator: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  gameType: string;
  timeRemaining: number;
  pendingConfiguration?: {
    playerSlots: PlayerSlot[];
  };
  players: Array<{ slotIndex: number; name: string }>;
}

export interface GameSlotInfo extends BaseSlotInfo {
  canJoin: boolean;
}

export class OpenGamesManager {
  public games: Writable<OpenGame[]> = writable([]);
  public loading: Writable<boolean> = writable(true);
  public error: Writable<string | null> = writable(null);
  public wsConnected: Writable<boolean> = writable(false);

  private refreshInterval: number | null = null;
  private wsUnsubscribe: (() => void) | null = null;
  private isDestroyed = false;

  async initialize() {
    await this.loadOpenGames();
    await this.setupRealtimeUpdates();
    this.startAutoRefresh();
  }

  async loadOpenGames() {
    // Don't load if we've been destroyed
    if (this.isDestroyed) {
      return 0;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      logger.debug('Loading open games...');
      const response = await fetch('/api/games/open');

      // Check again after async operation
      if (this.isDestroyed) {
        return 0;
      }

      if (response.ok) {
        const games = await response.json() as OpenGame[];
        logger.debug(`Received ${games.length} games:`, games);
        this.games.set(games.sort((a, b) => b.createdAt - a.createdAt));
        return games.length;
      } else {
        logger.error('Failed to fetch open games:', response.status);
        this.error.set(`Failed to load games: ${response.status}`);
        return 0;
      }
    } catch (err) {
      logger.error('Error loading games:', err);
      this.error.set('Failed to connect to server');
      return 0;
    } finally {
      if (!this.isDestroyed) {
        this.loading.set(false);
      }
    }
  }

  private async setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;
    // TODO: Implement WebSocket connection for real-time lobby updates
    // For now, rely on polling in startAutoRefresh()
    this.wsConnected.set(false);
  }

  private startAutoRefresh() {
    // Auto-refresh every 10 seconds as backup
    this.refreshInterval = window.setInterval(() => {
      if (!this.isDestroyed) {
        this.loadOpenGames();
      }
    }, GAME_CONSTANTS.LOBBY_POLL_INTERVAL_MS);
    logger.debug(`Started polling interval: ${this.refreshInterval}`);
  }

  async joinGameInSlot(gameId: string, slotIndex: number) {
    try {
      // Load the player's saved name from localStorage
      let playerName = loadPlayerName();

      // Fallback to default slot name if no saved name
      if (!playerName) {
        try {
          playerName = getPlayerConfig(slotIndex).defaultName;
        } catch (error) {
          playerName = getDefaultPlayerName(slotIndex);
        }
      }

      logger.debug(`Attempting to join game ${gameId} in slot ${slotIndex} as "${playerName}"`);

      const response = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, preferredSlot: slotIndex })
      });

      if (response.ok) {
        const result = await response.json() as { player: { name: string; slotIndex: number; isAI: boolean } };
        const player = result.player;

        logger.debug(`Join response received:`, {
          requestedSlot: slotIndex,
          returnedPlayer: {
            name: player.name,
            slotIndex: player.slotIndex,
            isAI: player.isAI
          }
        });

        saveGameCreator(gameId, {
          playerId: player.slotIndex.toString(),
          playerSlotIndex: player.slotIndex,
          playerName: player.name
        });

        logger.debug(`Saved to localStorage - playerSlotIndex: ${player.slotIndex}, playerName: ${player.name}`);

        // Cleanup BEFORE navigation to ensure polling stops immediately
        logger.debug('Joining game - cleaning up lobby resources before navigation');
        this.destroy();

        await goto(`/game/${gameId}`);
      } else {
        const errorData = await response.json() as { error?: string };
        const errorMsg = errorData.error || 'Failed to join game';
        logger.error('Join game failed:', errorData);
        this.error.set(errorMsg);
        setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
      }
    } catch (err: any) {
      const errorMsg = 'Network error: ' + err.message;
      logger.error('Network error joining game:', err);
      this.error.set(errorMsg);
      setTimeout(() => this.error.set(null), GAME_CONSTANTS.ERROR_MESSAGE_TIMEOUT_MS);
    }
  }

  getSlotInfo(game: OpenGame, slotIndex: number): GameSlotInfo {
    if (game.pendingConfiguration?.playerSlots) {
      const slot = game.pendingConfiguration.playerSlots[slotIndex];
      if (!slot || slot.type === 'Off') {
        return { type: 'disabled', name: 'Disabled', canJoin: false };
      }
      if (slot.type === 'Set') {
        return { type: 'creator', name: slot.name || slot.defaultName, canJoin: false };
      }
      if (slot.type === 'AI') {
        return { type: 'ai', name: slot.name || slot.defaultName, canJoin: false };
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

  destroy() {
    if (this.isDestroyed) {
      logger.debug('OpenGamesManager: Already destroyed, skipping cleanup');
      return;
    }

    logger.debug('OpenGamesManager: Cleaning up...');
    this.isDestroyed = true;

    if (this.refreshInterval !== null) {
      logger.debug(`Clearing polling interval: ${this.refreshInterval}`);
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.wsUnsubscribe) {
      this.wsUnsubscribe();
      this.wsUnsubscribe = null;
    }

    // Note: We do not disconnect the WebSocket here because it's a shared singleton
    // that may be used by other parts of the app (e.g., active game sessions).
    // We only clean up our local subscriptions and polling.

    this.wsConnected.set(false);
    logger.debug('OpenGamesManager: Cleanup complete');
  }
}
