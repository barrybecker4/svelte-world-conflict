import { writable, derived } from 'svelte/store';
import { turnManager } from '$lib/game/mechanics/TurnManager';
import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';

/**
 * Svelte Store for managing game state loading, initialization, and updates
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
    const isOtherPlayersTurn = updatedState.playerIndex !== playerIndex;

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
        // It's another player's turn - play their moves after banner
        setTimeout(() => {
          playOtherPlayerMoves(updatedState, currentState);
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
   * Play sound effects and show visual feedback for other player moves
   */
  function playOtherPlayerMoves(newState, previousState) {
    if (!previousState) return;

    console.log('🎬 Playing other player moves...');

    // Detect what changed between states to determine move types
    const moves = detectMovesFromStateDiff(newState, previousState);

    // Play moves with delays
    moves.forEach((move, index) => {
      setTimeout(() => {
        playMoveWithFeedback(move);
      }, index * 600); // 600ms between each move sound/effect
    });
  }

  /**
   * Detect moves by comparing game states
   */
  function detectMovesFromStateDiff(newState, previousState) {
    const moves = [];

    // Check for army movements (changed soldier positions)
    const newSoldiers = newState.soldiersByRegion || {};
    const oldSoldiers = previousState.soldiersByRegion || {};

    // Check for region ownership changes (conquests)
    const newOwners = newState.ownersByRegion || {};
    const oldOwners = previousState.ownersByRegion || {};

    Object.keys(newOwners).forEach(regionIndex => {
      const newOwner = newOwners[regionIndex];
      const oldOwner = oldOwners[regionIndex];

      if (oldOwner !== undefined && newOwner !== oldOwner) {
        // Region was conquered
        moves.push({
          type: 'conquest',
          regionIndex: parseInt(regionIndex),
          newOwner,
          oldOwner
        });
      }
    });

    // Check for soldier count changes (recruitment or movement)
    Object.keys(newSoldiers).forEach(regionIndex => {
      const newCount = (newSoldiers[regionIndex] || []).length;
      const oldCount = (oldSoldiers[regionIndex] || []).length;

      if (newCount > oldCount && newOwners[regionIndex] === previousState.playerIndex) {
        // Soldiers were recruited (only if same owner)
        moves.push({
          type: 'recruitment',
          regionIndex: parseInt(regionIndex),
          soldierCount: newCount - oldCount
        });
      } else if (newCount !== oldCount) {
        // Soldiers moved
        moves.push({
          type: 'movement',
          regionIndex: parseInt(regionIndex),
          oldCount,
          newCount
        });
      }
    });

    // Check for temple upgrades (simplified - could be improved)
    if (newState.templeUpgrades && previousState.templeUpgrades) {
      Object.keys(newState.templeUpgrades).forEach(regionIndex => {
        const newUpgrades = newState.templeUpgrades[regionIndex] || [];
        const oldUpgrades = previousState.templeUpgrades[regionIndex] || [];

        if (newUpgrades.length > oldUpgrades.length) {
          moves.push({
            type: 'upgrade',
            regionIndex: parseInt(regionIndex)
          });
        }
      });
    }

    return moves;
  }

  /**
   * Play a single move with appropriate sound and visual feedback
   */
  function playMoveWithFeedback(move) {
    console.log('🎯 Playing move:', move);

    switch (move.type) {
      case 'conquest':
        // Play attack and combat sounds
        audioSystem.playSound(SOUNDS.ATTACK);
        setTimeout(() => {
          audioSystem.playSound(SOUNDS.COMBAT);
          // Additional sound for conquest
          setTimeout(() => {
            audioSystem.playSound(SOUNDS.REGION_CONQUERED);
          }, 300);
        }, 200);

        // Visual feedback
        highlightRegion(move.regionIndex, 'conquest');
        break;

      case 'movement':
        // Play movement sound
        audioSystem.playSound(SOUNDS.SOLDIERS_MOVE);

        // Visual feedback
        highlightRegion(move.regionIndex, 'movement');
        break;

      case 'recruitment':
        // Play recruitment sound
        audioSystem.playSound(SOUNDS.SOLDIERS_RECRUITED);

        // Visual feedback
        highlightRegion(move.regionIndex, 'recruitment');
        break;

      case 'upgrade':
        // Play upgrade sound
        audioSystem.playSound(SOUNDS.TEMPLE_UPGRADED);

        // Visual feedback
        highlightRegion(move.regionIndex, 'upgrade');
        break;

      default:
        console.log('Unknown move type:', move.type);
    }
  }

  /**
   * Highlight a region with visual feedback
   */
  function highlightRegion(regionIndex, actionType) {
    // Dispatch custom event for visual highlighting
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('highlightRegion', {
        detail: {
          regionIndex,
          actionType,
          duration: 1500
        }
      }));
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
