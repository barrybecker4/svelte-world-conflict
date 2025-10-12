import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import type { GameStateData, Player, Region } from '$lib/game/entities/gameTypes';

/**
 * Svelte Store for managing game state loading, initialization, and updates
 */
export function createGameStateStore(gameId: string, playerId: string, playerSlotIndex: number) {

  const gameState = writable<GameStateData | null>(null);
  const regions = writable<Region[]>([]);
  const players = writable<Player[]>([]);
  const loading = writable<boolean>(true);
  const error = writable<string | null>(null);
  const eliminationBanners = writable<number[]>([]); // Array of player slot indices to show elimination banners for

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

      const data = await response.json() as { worldConflictState: any };
      gameState.set(data.worldConflictState);
      regions.set(data.worldConflictState.regions || []);
      players.set(data.worldConflictState.players || []);

      console.log('📊 Game state loaded:', {
        playerSlotIndex: data.worldConflictState.playerSlotIndex,
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
      error.set(errorMessage as any);
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

    // Check if turn changed (either player changed OR turn number increased, indicating a full round)
    const playerChanged = currentState && updatedState.currentPlayerSlot !== currentState.currentPlayerSlot;
    const turnNumberIncreased = currentState && updatedState.turnNumber > currentState.turnNumber;
    const isNewTurn = playerChanged || turnNumberIncreased;
    const isOtherPlayersTurn = updatedState.currentPlayerSlot !== playerSlotIndex;

    console.log('🎯 Turn transition check:', {
        'currentState.currentPlayerSlot': currentState?.currentPlayerSlot,
        'currentState.turnNumber': currentState?.turnNumber,
        'updatedState.currentPlayerSlot': updatedState.currentPlayerSlot,
        'updatedState.turnNumber': updatedState.turnNumber,
        'my playerSlotIndex': playerSlotIndex,
        'playerChanged': playerChanged,
        'turnNumberIncreased': turnNumberIncreased,
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

    // Check for elimination events and always update (clear if empty)
    if (cleanState.eliminatedPlayers && cleanState.eliminatedPlayers.length > 0) {
      console.log('💀 Players eliminated:', cleanState.eliminatedPlayers);
      eliminationBanners.set([...cleanState.eliminatedPlayers]);
    } else {
      // Clear elimination banners if no players were eliminated this update
      eliminationBanners.set([]);
    }

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
        audioSystem.playSound(SOUNDS.GAME_STARTED);
      }

      turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);
    } else {
      // Same player, just update state
      turnManager.updateGameState(cleanState);
    }

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
   * Complete elimination banner for a specific player
   */
  function completeEliminationBanner(playerSlotIndex: number) {
    console.log(`💀 Completing elimination banner for player ${playerSlotIndex}`);
    eliminationBanners.update(banners => banners.filter(p => p !== playerSlotIndex));
  }

  /**
   * Reset/cleanup turn manager
   */
  function resetTurnManager() {
    turnManager.reset();
  }

  const currentPlayerSlot = derived(gameState, ($gameState: GameStateData | null) =>
    $gameState?.currentPlayerSlot ?? 0
  );

  const currentPlayer = derived([players, currentPlayerSlot], ([$players, $currentPlayerSlot]: [Player[], number]): Player | null => {
    // Return null if players haven't loaded yet
    if (!$players || $players.length === 0) {
      return null;
    }

    const player = $players.find((p: Player) => p.slotIndex === $currentPlayerSlot);

    if (!player) {
      console.warn(`⚠️ Could not find player with slot index ${$currentPlayerSlot} in players array:`, $players);
      // Return the first player as fallback instead of throwing
      return $players[0] || null;
    }

    return player;
  });

  const isMyTurn = derived(
    [gameState, players],
    ([$gameState, $players]) => {
        if (!$gameState || !$players.length) return false;

        // Find the player whose turn it is (by slot index)
        const currentTurnPlayer = $players.find((p: any) => (p as any).slotIndex === ($gameState as any).currentPlayerSlot);

        const isMySlot = $gameState.currentPlayerSlot === playerSlotIndex;
        const isHumanPlayer = currentTurnPlayer && !currentTurnPlayer.personality;

        return isMySlot && isHumanPlayer;
    }
  );

  const movesRemaining = derived(gameState, $gameState =>
    $gameState?.movesRemaining ?? GAME_CONSTANTS.MAX_MOVES_PER_TURN
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
    eliminationBanners,

    // Derived stores
    currentPlayerSlot,
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
    completeEliminationBanner,
    resetTurnManager,

    // Move system getter
    getMoveSystem: () => moveSystem,

    // Access to move replayer for configuration
    getMoveReplayer: () => moveReplayer
  };
}
