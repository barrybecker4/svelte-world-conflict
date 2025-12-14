import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { GameStateUpdater } from './GameStateUpdater';
import { GameApiClient } from '$lib/client/gameController/GameApiClient';
import type { GameStateData, Player, Region } from '$lib/game/entities/gameTypes';
import type { BattleAnimationSystem } from '$lib/client/rendering/BattleAnimationSystem';
import { logger } from 'multiplayer-framework/shared';

/**
 * Svelte Store for managing game state loading, initialization, and updates.
 * 
 * This store orchestrates the game's reactive state management, coordinating:
 * - Core game state (regions, players, current turn)
 * - WebSocket updates (via GameStateUpdater)
 * - Move system and turn manager
 */
export function createGameStateStore(gameId: string, playerSlotIndex: number) {

  const gameState = writable<GameStateData | null>(null);
  const regions = writable<Region[]>([]);
  const players = writable<Player[]>([]);
  const loading = writable<boolean>(true);
  const error = writable<string | null>(null);
  const eliminationBanners = writable<number[]>([]); // Array of player slot indices to show elimination banners for
  const eliminatedPlayersTracker = writable<Set<number>>(new Set()); // Persistent tracker to prevent duplicate elimination banners
  
  let moveSystem: MoveSystem | null = null;
  const moveReplayer = new MoveReplayer();
  let battleAnimationSystemSet = false; // Track if we've set the animation system
  
  // Game state updater handles WebSocket updates with proper sequencing
  const gameStateUpdater = new GameStateUpdater(
    gameState,
    regions,
    players,
    eliminationBanners,
    playerSlotIndex,
    () => moveSystem,
    moveReplayer,
    (playerSlotIndex: number) => showEliminationBanner(playerSlotIndex)
  );

  const apiClient = new GameApiClient(gameId);

  /**
   * Load initial game state from the server
   */
  async function loadGameState() {
    try {
      const data = await apiClient.getGameState();
      
      if (!data.worldConflictState) {
        throw new Error('Failed to load game state');
      }

      gameState.set(data.worldConflictState);
      regions.set(data.worldConflictState.regions || []);
      players.set(data.worldConflictState.players || []);

      return data.worldConflictState;
    } catch (err) {
      logger.error('Failed to load game state:', err);
      throw err;
    }
  }

  /**
   * Initialize game systems (move system, turn manager)
   */
  async function initializeGame(
    handleMoveComplete: (from: number, to: number, soldiers: number) => Promise<void>,
    handleMoveStateChange: (state: MoveState) => void
  ) {
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
        
        // Initialize GameStateUpdater with initial state so it can detect future changes
        gameStateUpdater.initializeWithState(initialGameState);

        // Show initial turn banner if it's the local player's turn
        // Do this after a short delay to allow the UI to render first
        setTimeout(() => {
          turnManager.showInitialTurnBanner(playerSlotIndex);
        }, 100);
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
   * Delegates to GameStateUpdater for proper queuing and orchestration
   */
  function handleGameStateUpdate(updatedState: GameStateData) {
    gameStateUpdater.handleGameStateUpdate(updatedState);
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
    eliminationBanners.update(banners => banners.filter(p => p !== playerSlotIndex));
  }

  /**
   * Show elimination banner for a player (if not already shown)
   */
  function showEliminationBanner(playerSlotIndex: number) {
    let alreadyShown = false;
    eliminatedPlayersTracker.update(tracker => {
      alreadyShown = tracker.has(playerSlotIndex);
      if (!alreadyShown) {
        tracker.add(playerSlotIndex);
      }
      return tracker;
    });

    if (!alreadyShown) {
      eliminationBanners.update(banners => [...banners, playerSlotIndex]);
    }
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
      logger.warn(`Could not find player with slot index ${$currentPlayerSlot} in players array:`, $players);
      // Return the first player as fallback instead of throwing
      return $players[0] || null;
    }

    return player;
  });

  const isMyTurn = derived(
    [gameState, players],
    ([$gameState, $players]) => {
        if (!$gameState || !$players.length) return false;

        // Don't allow turns if game has ended
        if ($gameState.endResult) return false;

        // Find the player whose turn it is (by slot index)
        const currentTurnPlayer = $players.find((p: Player) => p.slotIndex === $gameState.currentPlayerSlot);

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

  // Replay banner stores - for showing banners before replaying other players' moves
  const shouldShowReplayBanner = turnManager.shouldShowReplayBanner;
  const replayPlayer = turnManager.replayPlayer;

  /**
   * Complete replay banner (called when replay banner animation finishes)
   */
  function completeReplayBanner() {
    turnManager.onReplayBannerComplete();
  }

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

    // Replay banner stores
    shouldShowReplayBanner,
    replayPlayer,

    // Actions
    loadGameState,
    initializeGame,
    handleGameStateUpdate,
    completeBanner,
    completeReplayBanner,
    completeEliminationBanner,
    showEliminationBanner,
    resetTurnManager,

    // Move system getter
    getMoveSystem: () => moveSystem,

    // Access to move replayer for configuration
    getMoveReplayer: () => moveReplayer,

    // Set battle animation system for move replayer
    setBattleAnimationSystem: (system: BattleAnimationSystem) => {
      if (!battleAnimationSystemSet) {
        moveReplayer.setBattleAnimationSystem(system);
        battleAnimationSystemSet = true;
      }
    },

    // Set callback for when turn is ready for player interaction
    setOnTurnReadyCallback: (callback: (gameState: GameStateData) => void) => {
      gameStateUpdater.setOnTurnReadyCallback(callback);
    },

    // Set callback to check if a battle is in progress
    setIsBattleInProgressCallback: (callback: () => boolean) => {
      gameStateUpdater.setIsBattleInProgressCallback(callback);
    },

    // Set callback to trigger AI processing when turn changes to AI player
    setTriggerAiProcessingCallback: (callback: () => Promise<void>) => {
      gameStateUpdater.setTriggerAiProcessingCallback(callback);
    }
  };
}
