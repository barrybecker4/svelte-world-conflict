import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { MoveReplayer } from '$lib/client/feedback/MoveReplayer';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { BattleAnimationUpdater } from './BattleAnimationUpdater';
import { GameStateUpdater } from './GameStateUpdater';
import type { GameStateData, Player, Region } from '$lib/game/entities/gameTypes';

/**
 * Svelte Store for managing game state loading, initialization, and updates.
 * 
 * This store orchestrates the game's reactive state management, coordinating:
 * - Core game state (regions, players, current turn)
 * - Battle animations (via BattleAnimationUpdater)
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
  
  // Battle animation updater manages visual overrides during combat
  const battleAnimationUpdater = new BattleAnimationUpdater(gameState);
  
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
    moveReplayer
  );

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
   * Delegates to GameStateUpdater for proper queuing and orchestration
   */
  function handleGameStateUpdate(updatedState: any) {
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
    // Core stores - use displayGameState from BattleAnimationUpdater which includes battle animation overrides
    gameState: battleAnimationUpdater.displayGameState,
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
    completeBanner,
    completeEliminationBanner,
    resetTurnManager,

    // Move system getter
    getMoveSystem: () => moveSystem,

    // Access to move replayer for configuration
    getMoveReplayer: () => moveReplayer,

    // Set battle animation system for move replayer
    setBattleAnimationSystem: (system: any) => {
      if (!battleAnimationSystemSet) {
        moveReplayer.setBattleAnimationSystem(system);
        battleAnimationSystemSet = true;
        console.log('🎬 Battle animation system set for move replayer');
      }
    }
  };
}
