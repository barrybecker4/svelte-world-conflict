import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';

/**
 * Svelte Store for managing game state loading, initialization, and updates
 */
export function createGameStateStore(gameId: string, playerId: string, playerIndex: number) {

  const gameState = writable(null);
  const regions = writable([]);
  const players = writable([]);
  const loading = writable(true);
  const error = writable(null);

  let moveSystem: MoveSystem | null = null;
  const moveReplayer = new MoveReplayer();

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
  async function initializeGame(handleMoveComplete: any, handleMoveStateChange: any) {
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
   * Now uses MoveReplayer for cleaner move playback logic
   */
  function handleGameStateUpdate(updatedState: any) {
    console.log('🎮 Received game update via WebSocket:', updatedState);

    // Get current state for comparison
    let currentState: any;
    gameState.subscribe(state => currentState = state)();

    const isNewTurn = currentState && updatedState.playerIndex !== currentState.playerIndex;
    const isOtherPlayersTurn = updatedState.playerIndex !== playerIndex;

    console.log('🎯 Turn transition check:', {
      'currentState.playerIndex': currentState?.playerIndex,
      'updatedState.playerIndex': updatedState.playerIndex,
      'my playerIndex': playerIndex,
      'isNewTurn': isNewTurn,
      'isOtherPlayersTurn': isOtherPlayersTurn
    });

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
      // New player's turn - show banner and handle audio
      console.log('🔄 Turn transition detected');

      // Play appropriate sounds based on whose turn it is
      if (isOtherPlayersTurn) {
        // It's another player's turn - use MoveReplayer after banner
        setTimeout(() => {
          moveReplayer.replayMoves(updatedState, currentState);
        }, GAME_CONSTANTS.BANNER_TIME); // Delay to show moves after banner
      } else {
        // It's now our turn
        audioSystem.playSound(SOUNDS.START);
      }

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
  async function retryInitialization(handleMoveComplete: any, handleMoveStateChange: any) {
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

  const currentPlayer = derived([players, currentPlayerIndex], ([$players, $currentPlayerIndex]) => {
    const player = $players.find(p => p.index === $currentPlayerIndex);

    if (!player) {
      throw new Exception(`⚠️ Could not find player with slot index ${$currentPlayerIndex} in players array:`, $players);
    }

    return player;
  });

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
    getMoveSystem: () => moveSystem,

    // Access to move replayer for configuration
    getMoveReplayer: () => moveReplayer
  };
}
