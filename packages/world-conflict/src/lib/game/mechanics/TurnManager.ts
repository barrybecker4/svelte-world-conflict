// Manages turn transitions, banners, and highlighting
import { writable, derived } from 'svelte/store';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { get } from 'svelte/store';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from '$lib/client/utils/logger';

interface TurnState {
  currentPlayerIndex: number;
  previousPlayerIndex: number | null;
  showBanner: boolean;
  bannerComplete: boolean;
  turnStartTime: number;
  isTransitioning: boolean;
}

class TurnManager {
  private turnState = writable<TurnState>({
    currentPlayerIndex: 0,
    previousPlayerIndex: null,
    showBanner: false,
    bannerComplete: true,
    turnStartTime: Date.now(),
    isTransitioning: false
  });

  private gameState = writable<GameStateData | null>(null);
  private players = writable<Player[]>([]);
  private previousSlotIndex: number | null = null;

  // Replay banner state - used to show banners before replaying other players' moves
  private replayBannerPlayer = writable<Player | null>(null);
  private lastReplayBannerSlot: number | null = null;
  private onReplayBannerCompleteCallback: (() => void) | null = null;

  // Public stores for components to subscribe to
  public readonly state = { subscribe: this.turnState.subscribe };
  public readonly gameData = { subscribe: this.gameState.subscribe };
  public readonly playerList = { subscribe: this.players.subscribe };

  // Derived stores for convenience
  public readonly currentPlayer = derived(
    [this.turnState, this.players],
    ([state, players]) => players[state.currentPlayerIndex] || null
  );

  public readonly previousPlayer = derived(
    [this.turnState, this.players],
    ([state, players]) => state.previousPlayerIndex !== null ? players[state.previousPlayerIndex] : null
  );

  public readonly shouldShowBanner = derived(
    this.turnState,
    state => state.showBanner && !state.bannerComplete
  );

  public readonly shouldHighlightRegions = derived(
    [this.turnState, this.gameState],
    ([state, gameState]) => state.bannerComplete && !state.isTransitioning && !gameState?.endResult
  );

  // Show banners before replaying other players' moves
  public readonly shouldShowReplayBanner = derived(
    this.replayBannerPlayer,
    player => player !== null
  );

  public readonly replayPlayer = { subscribe: this.replayBannerPlayer.subscribe };

  /**
   * Initialize the turn manager with game data
   */
  public initialize(gameState: GameStateData, players: Player[]): void {
      this.gameState.set(gameState);
      this.players.set(players);

      // currentPlayerSlot is slot index, find the array position
      const currentPlayer = players.find(p => p.slotIndex === gameState.currentPlayerSlot);
      const arrayIndex = currentPlayer ? players.indexOf(currentPlayer) : 0;

      // Set previousSlotIndex to track first player
      this.previousSlotIndex = gameState.currentPlayerSlot;

      // For the initial game state, show highlights immediately without banner
      // Banners are only for turn transitions, not the initial state
      this.turnState.update(state => ({
          ...state,
          currentPlayerIndex: arrayIndex,
          previousPlayerIndex: null,
          showBanner: false,
          bannerComplete: true,
          turnStartTime: Date.now()
      }));
  }

  /**
   * Show the initial "your turn" banner when loading into a game where it's already
   * the local player's turn. This is separate from turn transitions.
   */
  public async showInitialTurnBanner(localPlayerSlotIndex: number): Promise<void> {
    const gameState = get(this.gameState);
    if (!gameState) return;

    // Only show if it's the local player's turn
    if (gameState.currentPlayerSlot !== localPlayerSlotIndex) {
      return;
    }

    const players = get(this.players);
    const currentPlayer = players.find(p => p.slotIndex === localPlayerSlotIndex);
    if (!currentPlayer) return;

    return new Promise((resolve) => {
      this.turnState.update(state => ({
        ...state,
        showBanner: true,
        bannerComplete: false,
        isTransitioning: true
      }));

      this.onBannerCompleteCallback = () => {
        resolve();
      };

      // Auto-complete after BANNER_TIME
      setTimeout(() => {
        const state = get(this.turnState);
        if (state.showBanner && !state.bannerComplete) {
          this.onBannerComplete();
        }
      }, GAME_CONSTANTS.BANNER_TIME + 100);
    });
  }

  /**
   * Handle a turn transition to a new player
   */
  public async transitionToPlayer(newPlayerSlotIndex: number, gameState: GameStateData): Promise<void> {
      return new Promise(async (resolve) => {
        // Update game state AND players list first to ensure derived stores see correct data
        this.gameState.set(gameState);
        if (gameState.players) {
          this.players.set(gameState.players);
        }

        const newArrayIndex = this.findArrayIndexForSlot(newPlayerSlotIndex);
        const players = get(this.players);
        const newPlayer = players.find(p => p.slotIndex === newPlayerSlotIndex);
        const playerAtArrayIndex = players[newArrayIndex];

        // slot-based turn detection
        const isNewTurn = this.previousSlotIndex !== newPlayerSlotIndex;

        logger.debug('Turn transition:', {
          previousSlot: this.previousSlotIndex,
          newSlot: newPlayerSlotIndex,
          newPlayerName: newPlayer?.name,
          newArrayIndex,
          playerAtArrayIndex: playerAtArrayIndex ? { name: playerAtArrayIndex.name, slot: playerAtArrayIndex.slotIndex } : null,
          gameStateCurrentSlot: gameState.currentPlayerSlot,
          totalPlayers: players.length,
          isNewTurn
        });

        this.turnState.update(state => ({
          ...state,
          previousPlayerIndex: isNewTurn ? state.currentPlayerIndex : state.previousPlayerIndex,
          currentPlayerIndex: newArrayIndex,
          isTransitioning: true,
          showBanner: isNewTurn,
          bannerComplete: !isNewTurn,
          turnStartTime: isNewTurn ? Date.now() : state.turnStartTime
        }));

        this.previousSlotIndex = newPlayerSlotIndex;

        // Wait a tick to ensure derived stores update
        await new Promise(r => setTimeout(r, 0));

        // If showing a banner, set up auto-complete as a fallback
        // (in case the Banner component doesn't call onBannerComplete)
        if (isNewTurn) {
          setTimeout(() => {
            const state = get(this.turnState);
            if (state.isTransitioning || !state.bannerComplete) {
              logger.debug('🎭 Auto-completing turn transition (fallback)');
              this.onBannerComplete();
            }
          }, GAME_CONSTANTS.BANNER_TIME + 200);
        }

        setTimeout(() => resolve(), 100);
      });
  }

  private findArrayIndexForSlot(slotIndex: number): number {
    const players = get(this.players);
    const newPlayer = players.find(p => p.slotIndex === slotIndex);
    return newPlayer ? players.indexOf(newPlayer) : 0;
  }

  private onBannerCompleteCallback: (() => void) | null = null;

  /**
   * Called when the turn banner animation completes
   */
  public onBannerComplete(): void {
    this.hideBanner();
    this.completeTurnTransition();

    if (this.onBannerCompleteCallback) {
      this.onBannerCompleteCallback();
      this.onBannerCompleteCallback = null;
    }
  }

  /**
   * Complete the turn transition and enable region highlighting
   */
  private completeTurnTransition(): void {
    this.turnState.update(state => ({
      ...state,
      isTransitioning: false
    }));
  }

  /**
   * Update game state without triggering turn transition
   */
  public updateGameState(gameState: GameStateData): void {
    this.gameState.set(gameState);
  }

  /**
   * Update the current player slot tracking without showing a banner.
   * Call this when the turn changes to another player (not the local player)
   * so that the next transitionToPlayer call will correctly detect a new turn.
   */
  public updatePlayerSlotTracking(newPlayerSlotIndex: number): void {
    this.previousSlotIndex = newPlayerSlotIndex;
  }

  /**
   * Force enable region highlighting by ensuring transition is complete.
   * Call this after banner animations to make sure regions are highlighted.
   */
  public enableHighlighting(): void {
    this.turnState.update(state => ({
      ...state,
      isTransitioning: false,
      bannerComplete: true,
      showBanner: false
    }));
  }

  /**
   * Get regions owned by the current player
   */
  public getCurrentPlayerRegions(): number[] {
      const gameState = get(this.gameState);
      const players = get(this.players);
      const { currentPlayerIndex } = get(this.turnState);

      if (!gameState || !gameState.ownersByRegion) return [];

      // Get current player by array index, then use their slot index
      const currentPlayer = players[currentPlayerIndex];
      if (!currentPlayer) return [];

      const ownersByRegion = gameState.ownersByRegion;
      const playerSlotIndex = currentPlayer.slotIndex;

      return Object.keys(ownersByRegion)
          .map(k => parseInt(k))
          .filter(regionIndex => ownersByRegion[regionIndex] === playerSlotIndex);
  }

  /**
   * Get regions that can make moves (have more than 1 soldier)
   */
  public getMovableRegions(): number[] {
      const ownedRegions = this.getCurrentPlayerRegions();
      const gameState = get(this.gameState);

      if (!gameState) return [];

      return ownedRegions.filter(regionIndex => {
          const soldiers = gameState.soldiersByRegion[regionIndex] || [];
          return soldiers.length > 0;
      });
  }

  /**
   * Check if a region is owned by the current player
   */
  public isCurrentPlayerRegion(regionIndex: number): boolean {
    const gameState = get(this.gameState);
    const players = get(this.players);
    const { currentPlayerIndex } = get(this.turnState);

    if (!gameState || !gameState.ownersByRegion) return false;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return false;

    const ownersByRegion = gameState.ownersByRegion;
    return ownersByRegion[regionIndex] === currentPlayer.slotIndex;
  }

  /**
   * Force show the turn banner (useful for manual triggering)
   */
  public showBanner(): void {
    this.turnState.update(state => ({
      ...state,
      showBanner: true,
      bannerComplete: false
    }));
  }

  /**
   * Force hide the turn banner
   */
  public hideBanner(): void {
    this.turnState.update(state => ({
      ...state,
      showBanner: false,
      bannerComplete: true
    }));
  }

  /**
   * Get current turn statistics
   */
  public getTurnStats(): {
    currentPlayerIndex: number;
    turnDuration: number;
    ownedRegions: number;
    movableRegions: number;
  } {
    const state = get(this.turnState);

    const ownedRegions = this.getCurrentPlayerRegions();
    const movableRegions = this.getMovableRegions();

    return {
      currentPlayerIndex: state?.currentPlayerIndex ?? 0,
      turnDuration: Date.now() - (state?.turnStartTime ?? Date.now()),
      ownedRegions: ownedRegions.length,
      movableRegions: movableRegions.length
    };
  }

  /**
   * Reset the turn manager
   */
  public reset(): void {
    this.turnState.set({
      currentPlayerIndex: 0,
      previousPlayerIndex: null,
      showBanner: false,
      bannerComplete: true,
      turnStartTime: Date.now(),
      isTransitioning: false
    });

    this.gameState.set(null);
    this.players.set([]);
    this.clearReplayBannerTracking();
  }

  /**
   * Show a replay banner for a specific player before replaying their moves.
   * Only shows the banner if this player is different from the last replay banner shown.
   * Returns a promise that resolves when the banner animation completes.
   */
  public async showReplayBannerForPlayer(playerSlotIndex: number): Promise<void> {
    // Skip if we already showed a banner for this player
    if (this.lastReplayBannerSlot === playerSlotIndex) {
      logger.debug(`🎭 Skipping replay banner for slot ${playerSlotIndex} - already shown`);
      return;
    }

    const players = get(this.players);
    const player = players.find(p => p.slotIndex === playerSlotIndex);

    if (!player) {
      return;
    }

    logger.debug(`🎭 Showing replay banner for ${player.name} (slot ${playerSlotIndex})`);
    this.lastReplayBannerSlot = playerSlotIndex;

    return new Promise((resolve) => {
      this.replayBannerPlayer.set(player);
      this.onReplayBannerCompleteCallback = resolve;

      // Auto-complete after BANNER_TIME (in case onReplayBannerComplete isn't called)
      setTimeout(() => {
        if (get(this.replayBannerPlayer) === player) {
          this.onReplayBannerComplete();
        }
      }, GAME_CONSTANTS.BANNER_TIME + 100);
    });
  }

  /**
   * Called when the replay banner animation completes
   */
  public onReplayBannerComplete(): void {
    this.replayBannerPlayer.set(null);

    if (this.onReplayBannerCompleteCallback) {
      this.onReplayBannerCompleteCallback();
      this.onReplayBannerCompleteCallback = null;
    }
  }

  /**
   * Clear replay banner tracking - call when local player's turn starts
   * so the next round of replay banners will show correctly
   */
  public clearReplayBannerTracking(): void {
    this.lastReplayBannerSlot = null;
    this.replayBannerPlayer.set(null);
    this.onReplayBannerCompleteCallback = null;
  }
}

// Singleton instance
export const turnManager = new TurnManager();

// Export types for use in components
export type { TurnState };
