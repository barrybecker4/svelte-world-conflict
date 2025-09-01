import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/classes/TurnManager';
import { MoveSystem } from '$lib/game/classes/MoveSystem';

/**
 * Store for managing game state loading, initialization, and updates
 * Extracts game state management logic from WorldConflictGame component
 */
export function createGameStateStore(gameId, playerId, playerIndex) {
  // Core game state
  const gameState = writable(null);
  const regions = writable([]);
  const players = writable([]);
  const loading = writable(true);
  const error = writable(null);

  // Move system reference (will be initialized)
  let moveSystem = null;

  /**
   * Load initial game state from the server
   */
  async function loadGameState() {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      if (!response.ok) {
        throw new Error('Failed to load game state');
      }

      const data = await response.json();
      gameState.set(data.worldConflictState);
      regions.set(data.worldConflictState.regions || []);
      players.set(data.worldConflictState.players || []);

      console.log('📊 Game state loaded:', {
        playerIndex: data.worldConflictState.playerIndex,
        movesRemaining: data.worldConflictState.movesRemaining,
        regionsCount: data.worldConflictState.regions?.length,
        playersCount: data.worldConflictState.players?.length
      });

      return data.worldConflictState;
    } catch (err) {
      console.error('Failed to load game state:', err);
      throw err;
    }
  }

  /**
   * Initialize game systems (move system, turn manager)
   */
  async function initializeGame(handleMoveComplete, handleMoveStateChange) {
    try {
      const initialGameState = await loadGameState();

      // Initialize move system with proper callbacks
      if (initialGameState) {
        moveSystem = new MoveSystem(
          initialGameState,
          handleMoveComplete,
          handleMoveStateChange
        );

        // Get current players array
        const currentPlayers = initialGameState.players || [];

        turnManager.initialize(initialGameState, currentPlayers);
      }

      loading.set(false);
      return { gameState: initialGameState, moveSystem };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize game';
      error.set(errorMessage);
      loading.set(false);
      throw err;
    }
  }

  /**
   * Handle WebSocket game state updates
   */
  function handleGameStateUpdate(updatedState) {
    console.log('🎮 Received game update via WebSocket:', updatedState);

    // Get current state for comparison
    let currentState;
    gameState.subscribe(state => currentState = state)();

    const isNewTurn = currentState && updatedState.playerIndex !== currentState.playerIndex;

    // Ensure battle states are cleared from server updates
    const cleanState = {
      ...updatedState,
      battlesInProgress: [], // Force clear
      pendingMoves: []       // Force clear
    };

    gameState.set(cleanState);
    regions.set(cleanState.regions || []);
    players.set(cleanState.players || []);

    if (isNewTurn) {
      // New player's turn - show banner and transition
      turnManager.transitionToPlayer(cleanState.playerIndex, cleanState);
    } else {
      // Same player, just update state
      turnManager.updateGameState(cleanState);
    }

    // Update the existing move system with new game state
    if (moveSystem) {
      moveSystem.updateGameState(cleanState);
    }
  }

  /**
   * Retry loading game state (for error recovery)
   */
  async function retryInitialization(handleMoveComplete, handleMoveStateChange) {
    error.set(null);
    loading.set(true);
    await initializeGame(handleMoveComplete, handleMoveStateChange);
  }

  /**
   * Complete banner transition (called when banner animation finishes)
   */
  function completeBanner() {
    turnManager.onBannerComplete();
  }

  /**
   * Reset/cleanup turn manager
   */
  function resetTurnManager() {
    turnManager.reset();
  }

  // Derived stores for commonly used values
  const currentPlayerIndex = derived(gameState, $gameState =>
    $gameState?.playerIndex ?? 0
  );

  const currentPlayer = derived([players, currentPlayerIndex], ([$players, $currentPlayerIndex]) =>
    $players[$currentPlayerIndex]
  );

  const isMyTurn = derived(currentPlayerIndex, $currentPlayerIndex =>
    $currentPlayerIndex === playerIndex
  );

  const movesRemaining = derived(gameState, $gameState =>
    $gameState?.movesRemaining ?? 3
  );

  // Turn manager reactive stores
  const turnState = turnManager.state;
  const currentPlayerFromTurnManager = turnManager.currentPlayer;
  const shouldShowBanner = turnManager.shouldShowBanner;
  const shouldHighlightRegions = turnManager.shouldHighlightRegions;
  const gameStateFromTurnManager = turnManager.gameData;

  return {
    // Core stores
    gameState,
    regions,
    players,
    loading,
    error,

    // Derived stores
    currentPlayerIndex,
    currentPlayer,
    isMyTurn,
    movesRemaining,

    // Turn manager stores
    turnState,
    currentPlayerFromTurnManager,
    shouldShowBanner,
    shouldHighlightRegions,
    gameStateFromTurnManager,

    // Actions
    loadGameState,
    initializeGame,
    handleGameStateUpdate,
    retryInitialization,
    completeBanner,
    resetTurnManager,

    // Move system getter
    getMoveSystem: () => moveSystem
  };
}
