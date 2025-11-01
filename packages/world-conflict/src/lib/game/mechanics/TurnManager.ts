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

      // currentPlayerSlot is slot index, find the array position
      const currentPlayer = players.find(p => p.slotIndex === gameState.currentPlayerSlot);
      const arrayIndex = currentPlayer ? players.indexOf(currentPlayer) : 0;

      // Set previousSlotIndex to track first player
      this.previousSlotIndex = gameState.currentPlayerSlot;

      // Show banner for the first player's turn
      this.turnState.update(state => ({
          ...state,
          currentPlayerIndex: arrayIndex,
          previousPlayerIndex: null,
          showBanner: true,
          bannerComplete: false,
          turnStartTime: Date.now()
      }));
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

        console.log('Turn transition:', {
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
  }
}

// Singleton instance
export const turnManager = new TurnManager();

// Export types for use in components
export type { TurnState };
