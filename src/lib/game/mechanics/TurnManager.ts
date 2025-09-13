// Manages turn transitions, banners, and highlighting
import { writable, derived } from 'svelte/store';
import type { Player, GameStateData } from '$lib/game/state/GameState';
import { get } from 'svelte/store';

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
    this.turnState,
    state => state.bannerComplete && !state.isTransitioning
  );

  /**
   * Initialize the turn manager with game data
   */
  public initialize(gameState: GameStateData, players: Player[]): void {
    this.gameState.set(gameState);
    this.players.set(players);

    // playerIndex is slot index, find the array position
    const currentPlayer = players.find(p => p.index === gameState.playerIndex);
    const arrayIndex = currentPlayer ? players.indexOf(currentPlayer) : 0;

    this.turnState.update(state => ({
      ...state,
      currentPlayerIndex: arrayIndex, // Store array index for internal use
      turnStartTime: Date.now(),
      bannerComplete: false,
      showBanner: true,
      isTransitioning: false
    }));
  }

  /**
   * Handle a turn transition to a new player
   */
  public async transitionToPlayer(newPlayerSlotIndex: number, gameState: GameStateData): Promise<void> {
      return new Promise((resolve) => {
        this.gameState.set(gameState);

        const newArrayIndex = this.findArrayIndexForSlot(newPlayerSlotIndex);

        // slot-based turn detection
        const isNewTurn = this.previousSlotIndex !== newPlayerSlotIndex;

        console.log('Turn transition:', {
          previousSlot: this.previousSlotIndex,
          newSlot: newPlayerSlotIndex,
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

        setTimeout(() => resolve(), 100);
      });
  }

  private findArrayIndexForSlot(slotIndex: number): number {
    const players = get(this.players);
    const newPlayer = players.find(p => p.index === slotIndex);
    return newPlayer ? players.indexOf(newPlayer) : 0;
  }

  private onBannerCompleteCallback: (() => void) | null = null;

  private isNewTurn(newPlayerIndex: number): boolean {
    let currentIndex: number;
    this.turnState.subscribe(state => currentIndex = state.currentPlayerIndex)();
    return currentIndex !== newPlayerIndex;
  }

  /**
   * Called when the turn banner animation completes
   */
  public onBannerComplete(): void {
    this.hideBanner();

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
   * Get regions owned by the current player
   */
  public getCurrentPlayerRegions(): number[] {
      let gameState: GameStateData | null = null;
      let players: Player[] = [];
      let currentPlayerIndex: number = 0;

      this.gameState.subscribe(state => gameState = state)();
      this.players.subscribe(p => players = p)();
      this.turnState.subscribe(state => currentPlayerIndex = state.currentPlayerIndex)();

      if (!gameState?.ownersByRegion) return [];

      // Get current player by array index, then use their slot index
      const currentPlayer = players[currentPlayerIndex];
      if (!currentPlayer) return [];

      return Object.keys(gameState.ownersByRegion)
        .map(k => parseInt(k))
        .filter(regionIndex => gameState.ownersByRegion[regionIndex] === currentPlayer.index);
  }

  /**
   * Check if a region is owned by the current player
   */
  public isCurrentPlayerRegion(regionIndex: number): boolean {
    let gameState: GameStateData | null = null;
    let players: Player[] = [];
    let currentPlayerIndex: number = 0;

    this.gameState.subscribe(state => gameState = state)();
    this.players.subscribe(p => players = p)();
    this.turnState.subscribe(state => currentPlayerIndex = state.currentPlayerIndex)();

    if (!gameState?.ownersByRegion) return false;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return false;

    return gameState.ownersByRegion[regionIndex] === currentPlayer.index;
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
    let state: TurnState;
    let gameState: GameStateData | null = null;

    this.turnState.subscribe(s => state = s)();
    this.gameState.subscribe(gs => gameState = gs)();

    const ownedRegions = this.getCurrentPlayerRegions();
    const movableRegions = this.getMovableRegions();

    return {
      currentPlayerIndex: state!.currentPlayerIndex,
      turnDuration: Date.now() - state!.turnStartTime,
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
  }
}

// Singleton instance
export const turnManager = new TurnManager();

// Export types for use in components
export type { TurnState };
