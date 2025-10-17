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
  
  // Queue for handling multiple rapid state updates
  let updateQueue: any[] = [];
  let isProcessingUpdate = false;

  /**
   * Count the number of moves between two states for timing calculations
   */
  function countMoves(newState: any, previousState: any): number {
    if (!previousState) return 0;
    
    let moveCount = 0;
    
    // Count soldier changes
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};
    
    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;
      if (newCount !== oldCount) {
        moveCount++;
      }
    });
    
    // Count temple upgrades
    if (newState.templeUpgrades && previousState.templeUpgrades) {
      Object.keys(newState.templeUpgrades).forEach(regionIndex => {
        const newUpgrades = newState.templeUpgrades[regionIndex] || [];
        const oldUpgrades = previousState.templeUpgrades[regionIndex] || [];
        if (newUpgrades.length > oldUpgrades.length) {
          moveCount++;
        }
      });
    }
    
    return Math.max(moveCount, 1); // At least 1 move
  }

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
   * Updates are queued to ensure banners complete before next update
   */
  function handleGameStateUpdate(updatedState: any) {
    console.log('🎮 Received game update via WebSocket:', updatedState);
    
    // Add to queue
    updateQueue.push(updatedState);
    
    // Start processing if not already processing
    if (!isProcessingUpdate) {
      processNextUpdate();
    }
  }

  /**
   * Process queued updates one at a time
   */
  async function processNextUpdate() {
    if (updateQueue.length === 0) {
      isProcessingUpdate = false;
      return;
    }

    isProcessingUpdate = true;
    const updatedState = updateQueue.shift();

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
        'isOtherPlayersTurn': isOtherPlayersTurn,
        'queueLength': updateQueue.length
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

      await turnManager.transitionToPlayer(cleanState.currentPlayerSlot, cleanState);

      // Play appropriate sounds based on whose turn it is
      if (isOtherPlayersTurn) {
        // It's another player's turn - wait for banner, then replay moves
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            moveReplayer.replayMoves(updatedState, currentState);
            resolve();
          }, GAME_CONSTANTS.BANNER_TIME); // Banner duration
        });
        
        // Wait for move replay to complete (playback delay + animation time)
        await new Promise<void>((resolve) => {
          // Calculate total replay time: number of moves * playback delay
          const moveCount = countMoves(updatedState, currentState);
          const replayTime = moveCount * 600 + 500; // 600ms per move + 500ms for last animation
          setTimeout(() => resolve(), replayTime);
        });
      } else {
        // It's now our turn
        audioSystem.playSound(SOUNDS.GAME_STARTED);
        
        // Wait for banner to complete
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), GAME_CONSTANTS.BANNER_TIME + 100);
        });
      }
    } else {
      // Same player making another move - still need to replay with delay
      console.log('🔄 Same player move detected');
      turnManager.updateGameState(cleanState);
      
      // Replay moves from this update
      moveReplayer.replayMoves(updatedState, currentState);
      
      // Wait for move replay to complete
      await new Promise<void>((resolve) => {
        const moveCount = countMoves(updatedState, currentState);
        const replayTime = moveCount * 600 + 500; // 600ms per move + 500ms for last animation
        setTimeout(() => resolve(), replayTime);
      });
    }

    if (moveSystem) {
      moveSystem.updateGameState(cleanState);
    }

    // Process next update in queue
    processNextUpdate();
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
