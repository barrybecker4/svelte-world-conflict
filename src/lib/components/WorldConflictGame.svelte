<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameMap from './configuration/GameMap.svelte';
  import SoldierSelectionModal from './SoldierSelectionModal.svelte';
  import GameInstructions from './GameInstructions.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Button from './ui/Button.svelte';
  import Banner from './ui/Banner.svelte';
  import { turnManager } from '$lib/game/TurnManager';
  import type { GameStateData, Player } from '$lib/game/GameState';
  import { MoveSystem, type MoveState } from '$lib/game/classes/MoveSystem';
  import { BattleAnimationSystem } from '$lib/game/classes/BattleAnimationSystem';
  import { GameWebSocketClient } from '$lib/multiplayer/websocket/client';
  import DebugUI from './DebugUI.svelte';

  // Props
  export let gameId: string;
  export let playerId: string;
  export let playerIndex: number;

  // Game state
  let gameState = writable<GameStateData | null>(null);
  let regions: any[] = [];
  let players: Player[] = [];
  let loading = true;
  let error: string | null = null;

  // Move system
  let moveSystem: MoveSystem | null = null;
  let moveState: MoveState = {
    mode: 'IDLE',
    sourceRegion: null,
    targetRegion: null,
    selectedSoldierCount: 0,
    maxSoldiers: 0,
    availableMoves: 3,
    isMoving: false
  };

  let battleAnimationSystem: BattleAnimationSystem;
  let mapContainer: HTMLElement;

  // UI state
  let showSoldierSelection = false;
  let showInstructions = false;
  let audioEnabled = true;
  let soldierSelectionData: {
    maxSoldiers: number;
    currentSelection: number;
  } | null = null;
  let debugMode = false;

  $: turnState = turnManager.state;
  $: currentPlayerFromTurnManager = turnManager.currentPlayer;
  $: shouldShowBanner = turnManager.shouldShowBanner;
  $: shouldHighlightRegions = turnManager.shouldHighlightRegions;
  $: gameStateFromTurnManager = turnManager.gameData;
  $: currentPlayerIndex = $gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: isMyTurn = currentPlayerIndex === playerIndex;
  $: movesRemaining = $gameState?.movesRemaining ?? 3;
  $: moveMode = moveState.mode;
  $: selectedRegion = moveState.sourceRegion;
  $: showBanner = $shouldShowBanner;
  $: highlightRegions = $shouldHighlightRegions;
  $: currentPlayerForBanner = $currentPlayerFromTurnManager;
  $: connectionStatus = wsClient?.isConnected() ? 'connected' : 'disconnected';
  $: console.log('WebSocket status:', connectionStatus);
  $: {  // debug only
    if (mapContainer) {
      console.log('🗺️ Map container bound:', mapContainer);
    }
  }
  $: {
      if (mapContainer && battleAnimationSystem) {
        battleAnimationSystem.setMapContainer(mapContainer);
      }
    }

  let wsClient: GameWebSocketClient | null = null;

  onMount(async () => {
    battleAnimationSystem = new BattleAnimationSystem();
    await initializeGame();
    await initializeWebSocket();
  });

  onDestroy(() => {
    battleTimeouts.forEach(timeout => clearTimeout(timeout));
    battleTimeouts.clear();

    cleanupWebSocket();
    turnManager.reset();
  });

  async function initializeGame() {
    try {
      await loadGameState();

      // Initialize move system with proper callbacks
      if ($gameState) {
        moveSystem = new MoveSystem(
          $gameState,
          handleMoveComplete,
          handleMoveStateChange
        );

        turnManager.initialize($gameState, players);
      }

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize game';
      loading = false;
    }
  }

  async function initializeWebSocket() {
    try {
      wsClient = new GameWebSocketClient();

      wsClient.onGameUpdate((gameData) => {
        console.log('🎮 Received game update via WebSocket:', gameData);

        const worldConflictState = gameData.worldConflictState;
        if (worldConflictState) {
          const previousState = $gameState;
          const isNewTurn = previousState && worldConflictState.playerIndex !== previousState.playerIndex;

          // Clear battle timeouts for resolved battles
          if (previousState?.battlesInProgress) {
            previousState.battlesInProgress.forEach(regionIndex => {
              clearBattleTimeout(regionIndex);
            });
          }

          // Ensure battle states are cleared from server updates
          const cleanState = {
            ...worldConflictState,
            battlesInProgress: [], // Force clear
            pendingMoves: []       // Force clear
          };

          gameState.set(cleanState); // update reactive gameState

          regions = cleanState.regions || [];
          players = cleanState.players || [];

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
          } else {
            // Only create new MoveSystem if it doesn't exist
            moveSystem = new MoveSystem(
              cleanState,
              handleMoveComplete,
              handleMoveStateChange
            );
          }
        } else {
          console.error('❌ No worldConflictState found in gameData:', gameData);
        }
      });

      wsClient.onConnected(() => {
        console.log('✅ Connected to game WebSocket');
      });

      wsClient.onDisconnected(() => {
        console.log('🔌 Disconnected from game WebSocket');
      });

      wsClient.onError((error) => {
        console.error('❌ WebSocket error:', error);
      });

      // Connect to the WebSocket for this specific game
      await wsClient.connect(gameId);

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  function cleanupWebSocket() {
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }
  }

  async function loadGameState() {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      if (!response.ok) {
        throw new Error('Failed to load game state');
      }

      const data = await response.json();
      gameState.set(data.worldConflictState);
      regions = data.worldConflictState.regions || [];
      players = data.worldConflictState.players || [];

      // Update move system if it exists
      if (moveSystem && $gameState) {
        moveSystem = new MoveSystem(
          $gameState,
          handleMoveComplete,
          handleMoveStateChange
        );
      }

    } catch (err) {
      throw new Error('Failed to load game state');
    }
  }

  // Retry function for error state
  async function handleRetry() {
    error = null;
    loading = true;
    await initializeGame();
  }

  function handleBannerComplete(): void {
    turnManager.onBannerComplete();
  }

  // Move system callbacks
  function handleMoveStateChange(newState: MoveState) {
    console.log('Move state changed:', newState);
    moveState = { ...newState };

    // Show soldier selection modal when we need to select soldiers
    if (newState.mode === 'ADJUST_SOLDIERS' && newState.sourceRegion !== null) {
      soldierSelectionData = {
        maxSoldiers: newState.maxSoldiers,
        currentSelection: newState.selectedSoldierCount
      };
      showSoldierSelection = true;
    } else {
      showSoldierSelection = false;
      soldierSelectionData = null;
    }
  }

  async function handleMoveComplete(sourceRegionIndex: number, targetRegionIndex: number, soldierCount: number) {
    console.log('Starting move execution:', { sourceRegionIndex, targetRegionIndex, soldierCount });

    try {
      const currentState = $gameState;
      if (currentState) {
        updateLocalState(currentState, sourceRegionIndex, targetRegionIndex, soldierCount);
      }

      // Send move to server
      const response = await fetch(`/api/game/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moveType: 'ARMY_MOVE',
          playerId,
          source: sourceRegionIndex,
          destination: targetRegionIndex,
          count: soldierCount
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Move processed successfully:', result);

      // Ensure map container is set before playing animations
      if (result.attackSequence && result.attackSequence.length > 0) {
        console.log('🎬 Playing attack sequence from server response');

        // Wait a tick to ensure map container is available
        await new Promise(resolve => setTimeout(resolve, 0));

        // Double-check map container is set
        if (mapContainer && battleAnimationSystem) {
          console.log('🗺️ Map container available, setting on animation system');
          battleAnimationSystem.setMapContainer(mapContainer);
          await battleAnimationSystem.playAttackSequence(result.attackSequence, regions);
        } else {
          console.warn('⚠️ Map container not available for animations:', { mapContainer: !!mapContainer, battleAnimationSystem: !!battleAnimationSystem });
          // Fallback: just log what would have been shown
          console.log('🎭 Attack sequence (no animation):', result.attackSequence);
        }
      }

      clearBattleTimeout(targetRegionIndex);

      // Clear battle states when server responds
      if (result.gameState) {
        const updatedState = {
          ...result.gameState,
          battlesInProgress: [],
          pendingMoves: []
        };

        console.log('Updating game state with server response. gameState.ownersByRegion = ', updatedState.ownersByRegion);
        gameState.set(updatedState);
      } else {
        // Even if no gameState in response, clear battle states
        gameState.update(state => {
          if (!state) return state;
          return {
            ...state,
            battlesInProgress: [],
            pendingMoves: []
          };
        });
      }

    } catch (moveError) {
      console.error('❌ Move failed:', moveError);

      clearBattleTimeout(targetRegionIndex);

      // Clear any temporary battle states on error
      if ($gameState) {
        const cleanState = {
          ...$gameState,
          battlesInProgress: [],
          pendingMoves: []
        };
        gameState.set(cleanState);
      }

      throw moveError;
    }
  }

  function clearBattleTimeout(regionIndex: number) {
    const timeout = battleTimeouts.get(regionIndex);
    if (timeout) {
      clearTimeout(timeout);
      battleTimeouts.delete(regionIndex);
    }
  }

  function updateLocalState(currentState: GameStateData,
                           sourceRegionIndex: number,
                           targetRegionIndex: number,
                           soldierCount: number) {

    const targetSoldiers = currentState.soldiersByRegion?.[targetRegionIndex] || [];
    const sourceSoldiers = currentState.soldiersByRegion?.[sourceRegionIndex] || [];
    const targetOwner = currentState.ownersByRegion?.[targetRegionIndex];
    const playerIndex = currentState.playerIndex;

    const isNeutralWithSoldiers = targetOwner === undefined && targetSoldiers.length > 0;
    const isEnemyTerritory = targetOwner !== undefined && targetOwner !== playerIndex && targetSoldiers.length > 0;
    const isHostileTerritory = isNeutralWithSoldiers || isEnemyTerritory;

    console.log('Move analysis:', {
      targetRegion: targetRegionIndex,
      targetSoldiers: targetSoldiers.length,
      targetOwner,
      playerIndex,
      isNeutralWithSoldiers,
      isEnemyTerritory,
      isHostileTerritory
    });

    if (isHostileTerritory) {
      startBattle(sourceRegionIndex, targetRegionIndex, soldierCount, currentState);
    } else {
      moveIntoRegion(sourceRegionIndex, targetRegionIndex, soldierCount, currentState, sourceSoldiers, targetSoldiers, targetOwner);
    }
  }

  function startBattle(sourceRegionIndex: number, targetRegionIndex: number, soldierCount: number, currentState: GameStateData) {
    console.log('Battle starting at region', targetRegionIndex);

    startBattleTimeout(targetRegionIndex); // timeout to prevent stuck battles

    const battleState = {
      ...currentState,
      battlesInProgress: [...new Set([...(currentState.battlesInProgress || []), targetRegionIndex])],
      pendingMoves: [
        ...(currentState.pendingMoves || []),
        { from: sourceRegionIndex, to: targetRegionIndex, count: soldierCount }
      ]
    };

    gameState.set(battleState);
  }

  function moveIntoRegion(sourceRegionIndex: number, targetRegionIndex: number, soldierCount: number, currentState: GameStateData, sourceSoldiers: number[], targetSoldiers: number[], targetOwner: number | undefined) {
    console.log('🚶 Moving to neutral/friendly territory');
    const newSourceSoldiers = sourceSoldiers.slice(soldierCount);  // Remove soldiers from source

    // Add soldiers to target
    const newTargetSoldiers = [
      ...targetSoldiers,
      ...Array(soldierCount).fill({ playerId: playerIndex })
    ];

    const moveState = {
      ...currentState,
      soldiersByRegion: {
        ...currentState.soldiersByRegion,
        [sourceRegionIndex]: newSourceSoldiers,
        [targetRegionIndex]: newTargetSoldiers
      }
    };

    // Claim neutral territory if it's unowned
    if (targetOwner === undefined) {
      moveState.ownersByRegion = {
        ...currentState.ownersByRegion,
        [targetRegionIndex]: playerIndex
      };
      console.log('Claiming neutral region', targetRegionIndex);
    }

    gameState.set(moveState);
  }

  function handleRegionClick(region: any) {
    console.log('Region clicked:', region);

    // Prevent actions during turn transition
    if ($turnState.isTransitioning) {
      console.log('Ignoring click during turn transition');
      return;
    }

    if (!isMyTurn) {
      console.log('Not my turn, ignoring click');
      return;
    }

    if (moveSystem) {
      moveSystem.handleRegionClick(region.index);
    }
  }

  let battleTimeouts = new Map<number, number>();

  function startBattleTimeout(regionIndex: number) {
    // Clear any existing timeout for this region
    const existingTimeout = battleTimeouts.get(regionIndex);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout (5 seconds) - setTimeout returns number in browser
    const timeout = setTimeout(() => {
      console.warn(`⚠️ Battle timeout for region ${regionIndex}, clearing battle state`);

      gameState.update(state => {
        if (!state) return state;

        return {
          ...state,
          battlesInProgress: state.battlesInProgress?.filter(r => r !== regionIndex) || [],
          pendingMoves: state.pendingMoves?.filter(m => m.to !== regionIndex) || []
        };
      });

      battleTimeouts.delete(regionIndex);
    }, 5000);

    battleTimeouts.set(regionIndex, timeout);
  }

  function handleSoldierSelectionConfirm(soldierCount: number) {
    console.log('Soldier selection:', soldierCount);
    if (moveSystem) {
      moveSystem.handleSoldierAdjustment(soldierCount);
    }

    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  function handleSoldierSelectionCancel() {
    console.log('Soldier selection cancelled');

    if (moveSystem) {
      moveSystem.cancelMove();
    }

    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  async function handleEndTurn() {
    console.log('Ending turn...');
    try {
      const response = await fetch(`/api/game/${gameId}/end-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: playerId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Turn ended successfully:', result);

        // Reset move state
        moveState = {
          mode: 'IDLE',
          sourceRegion: null,
          targetRegion: null,
          selectedSoldierCount: 0,
          maxSoldiers: 0,
          availableMoves: 3,
          isMoving: false
        };
      } else {
        const error = await response.json();
        console.error('❌ Failed to end turn:', error);
        alert(error.message || 'Failed to end turn');
      }
    } catch (error) {
      console.error('❌ Network error ending turn:', error);
      alert('Network error: ' + error.message);
    }
  }

  function handleUndo() {
    console.log('Undo requested');
    if (moveSystem) {
      moveSystem.undo();
    }
  }

  function handleCancelMove() {
    console.log('Cancel move requested');
    if (moveSystem) {
      moveSystem.cancelMove();
    }
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleToggleAudio() {
    audioEnabled = !audioEnabled;
    console.log('Audio toggled:', audioEnabled);
  }

  function handleResign() {
    const confirmed = confirm('Are you sure you want to resign from this game?');
    if (confirmed) {
      console.log('Player resigned');
      // TODO: Implement resignation logic
    }
  }
</script>

<!-- Turn Banner Overlay -->
{#if showBanner && currentPlayerForBanner}
  <Banner
    player={currentPlayerForBanner}
    isVisible={showBanner}
    onComplete={handleBannerComplete}
  />
{/if}

<LoadingState
  {loading}
  {error}
  loadingText="Loading game..."
  containerClass="fullscreen"
  showRetry={true}
  on:retry={handleRetry}
>
  <div class="game-container">
    <!-- Left Panel: Game Info -->
    <div class="info-panel">
      <GameInfoPanel
        gameState={$gameState}
        {players}
        currentPlayer={currentPlayer}
        {currentPlayerIndex}
        {movesRemaining}
        moveInstruction={moveSystem?.getCurrentInstruction() || ''}
        showCancelButton={moveState.mode !== 'IDLE'}
        {audioEnabled}
        onEndTurn={handleEndTurn}
        onUndo={handleUndo}
        onCancelMove={handleCancelMove}
        onToggleAudio={handleToggleAudio}
        onShowInstructions={handleShowInstructions}
        onResign={handleResign}
      />
    </div>

    <div class="map-container">
      <GameMap
        {regions}
        gameState={$gameState}
        currentPlayer={currentPlayer}
        selectedRegion={moveState.sourceRegion ? regions.find(r => r.index === moveState.sourceRegion) : null}
        showTurnHighlights={highlightRegions}
        onRegionClick={handleRegionClick}
        previewMode={loading || $turnState.isTransitioning}
        bind:mapContainer
      />
    </div>
  </div>

  {#if debugMode}
    <DebugUI
      gameState={$gameState}
      {players}
      visible={true}
    />
  {/if}

  {#if showSoldierSelection && soldierSelectionData}
    <SoldierSelectionModal
      maxSoldiers={soldierSelectionData.maxSoldiers}
      currentSelection={soldierSelectionData.currentSelection}
      onConfirm={handleSoldierSelectionConfirm}
      onCancel={handleSoldierSelectionCancel}
    />
  {/if}

  {#if showInstructions}
    <GameInstructions on:complete={() => showInstructions = false} />
  {/if}
</LoadingState>

<style>
  .game-container {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    color: white;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .info-panel {
    width: 320px;
    min-width: 320px;
    background: rgba(15, 23, 42, 0.9);
    border-right: 2px solid #374151;
    overflow-y: auto;
    z-index: 10;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* Responsive design */
  @media (max-width: 1024px) {
    .game-container {
      flex-direction: column;
    }

    .info-panel {
      width: 100%;
      height: 200px;
      border-right: none;
      border-bottom: 2px solid #374151;
    }

    .map-container {
      height: calc(100vh - 200px);
    }
  }

  @media (max-width: 640px) {
    .info-panel {
      height: 150px;
    }

    .map-container {
      height: calc(100vh - 150px);
    }
  }
</style>
