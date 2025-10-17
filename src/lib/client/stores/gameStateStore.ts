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
  
  // Battle animation overrides - temporarily adjust soldier counts and ownership during animations
  const battleAnimationOverrides = writable<{
    soldierCounts: Record<number, number>;
    ownership: Record<number, number | undefined>;
  }>({ soldierCounts: {}, ownership: {} });
  
  // Create a derived store that applies battle animation overrides to the game state
  const displayGameState = derived(
    [gameState, battleAnimationOverrides],
    ([$gameState, $overrides]) => {
      if (!$gameState || (Object.keys($overrides.soldierCounts).length === 0 && Object.keys($overrides.ownership).length === 0)) {
        return $gameState;
      }
      
      // Clone the game state and apply overrides
      const modifiedState = { ...$gameState };
      modifiedState.soldiersByRegion = { ...modifiedState.soldiersByRegion };
      modifiedState.ownersByRegion = { ...modifiedState.ownersByRegion };
      
      // Apply soldier count overrides
      for (const [regionIndex, newCount] of Object.entries($overrides.soldierCounts)) {
        const regionIdx = parseInt(regionIndex);
        const currentSoldiers = $gameState.soldiersByRegion?.[regionIdx] || [];
        
        // Adjust soldier array to match the override count
        if (newCount < currentSoldiers.length) {
          modifiedState.soldiersByRegion[regionIdx] = currentSoldiers.slice(0, newCount);
        } else if (newCount > currentSoldiers.length) {
          // This shouldn't happen during battle animations, but handle it anyway
          modifiedState.soldiersByRegion[regionIdx] = [...currentSoldiers];
        } else {
          modifiedState.soldiersByRegion[regionIdx] = currentSoldiers;
        }
      }
      
      // Apply ownership overrides
      for (const [regionIndex, owner] of Object.entries($overrides.ownership)) {
        const regionIdx = parseInt(regionIndex);
        if (owner === undefined) {
          delete modifiedState.ownersByRegion[regionIdx];
        } else {
          modifiedState.ownersByRegion[regionIdx] = owner;
        }
      }
      
      return modifiedState;
    }
  );

  let moveSystem: MoveSystem | null = null;
  const moveReplayer = new MoveReplayer();
  let battleAnimationSystemSet = false; // Track if we've set the animation system
  
  // Queue for handling multiple rapid state updates
  let updateQueue: any[] = [];
  let isProcessingUpdate = false;

  // Set up battle animation event listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('battleAnimationStart', ((event: CustomEvent) => {
      const { sourceRegion, targetRegion, sourceCount, targetCount, targetOwner } = event.detail;
      console.log(`🎬 Battle animation starting - initializing overrides: Source ${sourceRegion}: ${sourceCount}, Target ${targetRegion}: ${targetCount}, Owner: ${targetOwner}`);
      
      // Initialize overrides with starting counts and ownership to "freeze" the display before animation
      battleAnimationOverrides.set({
        soldierCounts: {
          [sourceRegion]: sourceCount,
          [targetRegion]: targetCount
        },
        ownership: {
          [targetRegion]: targetOwner // Preserve original owner during animation
        }
      });
    }) as EventListener);
    
    window.addEventListener('battleRoundUpdate', ((event: CustomEvent) => {
      const { sourceRegion, targetRegion, attackerLosses, defenderLosses } = event.detail;
      updateBattleAnimation(sourceRegion, targetRegion, attackerLosses, defenderLosses);
    }) as EventListener);
    
    window.addEventListener('battleComplete', (() => {
      clearBattleAnimationOverrides();
    }) as EventListener);
  }

  // Store reference to current game state for battle animations
  let currentGameStateSnapshot: GameStateData | null = null;
  gameState.subscribe(state => {
    currentGameStateSnapshot = state;
  });

  /**
   * Update battle animation overrides for real-time soldier count display
   */
  function updateBattleAnimation(sourceRegion: number, targetRegion: number, attackerLosses: number, defenderLosses: number) {
    if (!currentGameStateSnapshot) return;
    
    battleAnimationOverrides.update(overrides => {
      const newOverrides = {
        soldierCounts: { ...overrides.soldierCounts },
        ownership: { ...overrides.ownership }
      };
      
      const sourceSoldiers = currentGameStateSnapshot!.soldiersByRegion?.[sourceRegion]?.length || 0;
      const targetSoldiers = currentGameStateSnapshot!.soldiersByRegion?.[targetRegion]?.length || 0;
      
      // Apply losses
      const newSourceCount = Math.max(0, (newOverrides.soldierCounts[sourceRegion] ?? sourceSoldiers) - attackerLosses);
      const newTargetCount = Math.max(0, (newOverrides.soldierCounts[targetRegion] ?? targetSoldiers) - defenderLosses);
      
      newOverrides.soldierCounts[sourceRegion] = newSourceCount;
      newOverrides.soldierCounts[targetRegion] = newTargetCount;
      
      console.log(`🎯 Battle animation update: Source ${sourceRegion}: ${sourceSoldiers} -> ${newSourceCount}, Target ${targetRegion}: ${targetSoldiers} -> ${newTargetCount}`);
      
      return newOverrides;
    });
  }

  /**
   * Clear battle animation overrides after animation completes
   */
  function clearBattleAnimationOverrides() {
    console.log('🎯 Clearing battle animation overrides');
    battleAnimationOverrides.set({ soldierCounts: {}, ownership: {} });
  }

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

    // Check for elimination events - add new eliminations but don't auto-clear
    if (cleanState.eliminatedPlayers && cleanState.eliminatedPlayers.length > 0) {
      console.log('💀 Players eliminated:', cleanState.eliminatedPlayers);
      // Add new eliminations to existing banners (don't replace)
      eliminationBanners.update(existing => {
        const newBanners = [...existing];
        cleanState.eliminatedPlayers.forEach((playerSlot: number) => {
          if (!newBanners.includes(playerSlot)) {
            newBanners.push(playerSlot);
          }
        });
        return newBanners;
      });
    }
    // Don't auto-clear banners - they are cleared when user completes them via completeEliminationBanner

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
          let replayTime = moveCount * 600 + 500; // 600ms per move + 500ms for last animation
          
          // If there's a battle sequence, add time for blow-by-blow animation
          if (updatedState.attackSequence && updatedState.attackSequence.length > 0) {
            // Each battle round takes 500ms
            replayTime += updatedState.attackSequence.length * 500;
          }
          
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
      // Same player slot - could be our move or another player's move (in multiplayer)
      console.log('🔄 Same player slot move detected');
      turnManager.updateGameState(cleanState);
      
      // Only replay moves if it's another player's turn (to avoid double animations)
      // When it's our own move, BattleManager already animated it
      if (isOtherPlayersTurn) {
        console.log('🔄 Replaying other player\'s move');
        // Replay moves from this update
        moveReplayer.replayMoves(updatedState, currentState);
        
        // Wait for move replay to complete
        await new Promise<void>((resolve) => {
          const moveCount = countMoves(updatedState, currentState);
          let replayTime = moveCount * 600 + 500; // 600ms per move + 500ms for last animation
          
          // If there's a battle sequence, add time for blow-by-blow animation
          if (updatedState.attackSequence && updatedState.attackSequence.length > 0) {
            // Each battle round takes 500ms
            replayTime += updatedState.attackSequence.length * 500;
          }
          
          setTimeout(() => resolve(), replayTime);
        });
      } else {
        console.log('✅ Skipping replay for our own move (already animated by BattleManager)');
        // For our own moves, don't clear overrides here - let BattleManager handle it
        // The WebSocket update just updates the underlying state, which shows through when overrides clear
      }
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
    // Core stores - use displayGameState which includes battle animation overrides
    gameState: displayGameState,
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
