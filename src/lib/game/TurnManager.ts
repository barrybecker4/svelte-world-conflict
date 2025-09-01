// Manages turn transitions, banners, and highlighting
import { writable, derived } from 'svelte/store';
import type { Player, GameStateData } from '$lib/game/GameState';

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

    this.turnState.update(state => ({
      ...state,
      currentPlayerIndex: gameState.playerIndex,
      turnStartTime: Date.now(),
      bannerComplete: false,
      showBanner: true,
      isTransitioning: false
    }));
  }

  /**
   * Handle a turn transition to a new player
   */
  public async transitionToPlayer(newPlayerIndex: number, gameState: GameStateData): Promise<void> {
    return new Promise((resolve) => {
      this.turnState.update(state => {
        const isNewTurn = state.currentPlayerIndex !== newPlayerIndex;

        return {
          ...state,
          previousPlayerIndex: isNewTurn ? state.currentPlayerIndex : state.previousPlayerIndex,
          currentPlayerIndex: newPlayerIndex,
          isTransitioning: true,
          showBanner: isNewTurn,
          bannerComplete: !isNewTurn,
          turnStartTime: isNewTurn ? Date.now() : state.turnStartTime
        };
      });

      this.gameState.set(gameState);

      // If it's a new turn, wait for banner completion
      if (this.isNewTurn(newPlayerIndex)) {
        // Banner will call onBannerComplete when done
        this.onBannerCompleteCallback = () => {
          this.completeTurnTransition();
          resolve();
        };
      } else {
        // No banner needed, complete immediately
        this.completeTurnTransition();
        resolve();
      }
    });
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
    this.turnState.update(state => ({
      ...state,
      bannerComplete: true,
      showBanner: false
    }));

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
    let currentPlayerIndex: number = 0;

    this.gameState.subscribe(state => gameState = state)();
    this.turnState.subscribe(state => currentPlayerIndex = state.currentPlayerIndex)();

    if (!gameState?.ownersByRegion) return [];

    return Object.entries(gameState.ownersByRegion)
      .filter(([_, ownerIndex]) => ownerIndex === currentPlayerIndex)
      .map(([regionIndex, _]) => parseInt(regionIndex));
  }

  /**
   * Get regions that can move (have soldiers and haven't moved this turn)
   */
  public getMovableRegions(): number[] {
    let gameState: GameStateData | null = null;
    this.gameState.subscribe(state => gameState = state)();

    if (!gameState) return [];

    const playerRegions = this.getCurrentPlayerRegions();

    return playerRegions.filter(regionIndex => {
      const soldiers = gameState!.soldiersByRegion?.[regionIndex];
      const soldierCount = soldiers ? soldiers.length : 0;
      const hasMovedThisTurn = gameState!.conqueredRegions?.includes(regionIndex) ?? false;

      return soldierCount > 1 && !hasMovedThisTurn;
    });
  }

  /**
   * Check if a region is owned by the current player
   */
  public isCurrentPlayerRegion(regionIndex: number): boolean {
    let gameState: GameStateData | null = null;
    let currentPlayerIndex: number = 0;

    this.gameState.subscribe(state => gameState = state)();
    this.turnState.subscribe(state => currentPlayerIndex = state.currentPlayerIndex)();

    if (!gameState?.ownersByRegion) return false;
    return gameState.ownersByRegion[regionIndex] === currentPlayerIndex;
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
