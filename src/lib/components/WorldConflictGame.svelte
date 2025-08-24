<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameMap from './configuration/GameMap.svelte';
  import SoldierSelectionModal from './SoldierSelectionModal.svelte';
  import GameInstructions from './GameInstructions.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Button from './ui/Button.svelte';
  import Banner from './ui/Banner.svelte';
  import type { MoveState } from '$lib/game/classes/MoveSystem';
  import { BattleAnimationSystem } from '$lib/game/classes/BattleAnimationSystem';
  import { GameWebSocketClient } from '$lib/game/websocket/client';
  import { createGameStateStore } from '$lib/game/stores/gameStateStore.js';
  import DebugUI from './DebugUI.svelte';

  // Props
  export let gameId: string;
  export let playerId: string;
  export let playerIndex: number;

  // Game state store - destructure the individual stores
  const gameStore = createGameStateStore(gameId, playerId, playerIndex);
  const {
    gameState,
    regions,
    players,
    loading,
    error,
    currentPlayerIndex,
    currentPlayer,
    isMyTurn,
    movesRemaining,
    turnState,
    currentPlayerFromTurnManager,
    shouldShowBanner,
    shouldHighlightRegions
  } = gameStore;

  // Move system and state
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

  // Battle management
  let battleTimeouts = new Map<number, number>();

  // WebSocket client
  let wsClient: GameWebSocketClient | null = null;

  // UI reactive variables
  $: moveMode = moveState.mode;
  $: selectedRegion = moveState.sourceRegion;
  $: showBanner = $shouldShowBanner;
  $: highlightRegions = $shouldHighlightRegions;
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

  onMount(async () => {
    battleAnimationSystem = new BattleAnimationSystem();
    await initializeGame();
    await initializeWebSocket();
  });

  onDestroy(() => {
    battleTimeouts.forEach(timeout => clearTimeout(timeout));
    battleTimeouts.clear();
    cleanupWebSocket();
    gameStore.resetTurnManager();
  });

  async function initializeGame() {
    await gameStore.initializeGame(handleMoveComplete, handleMoveStateChange);
  }

  async function initializeWebSocket() {
    try {
      wsClient = new GameWebSocketClient();

      wsClient.onGameUpdate((gameData) => {
        console.log('🎮 Received game update via WebSocket:', gameData);

        const worldConflictState = gameData.worldConflictState;
        if (worldConflictState) {
          gameStore.handleGameStateUpdate(worldConflictState);
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
          await battleAnimationSystem.playAttackSequence(result.attackSequence, $regions);
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

  function moveIntoRegion(sourceRegionIndex: number, targetRegionIndex: number, soldierCount: number, currentState: GameStateData, sourceSoldiers: any[], targetSoldiers: any[], targetOwner: number | undefined) {
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

    gameStore.getMoveSystem().handleRegionClick(region.index);
  }

  function handleSoldierSelectionConfirm(soldierCount: number) {
    gameStore.getMoveSystem().handleSoldierAdjustment(soldierCount);
    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  function handleSoldierSelectionCancel() {
    gameStore.getMoveSystem().cancelMove();
    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  async function handleEndTurn() {
    if (!$isMyTurn) return;

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
    if (!$isMyTurn) return;
    gameStore.getMoveSystem().undo();
  }

  function handleCancelMove() {
    gameStore.getMoveSystem().cancelCurrentMove();
  }

  function handleToggleAudio() {
    audioEnabled = !audioEnabled;
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleRetry() {
    gameStore.retryInitialization(handleMoveComplete, handleMoveStateChange);
  }

  function handleBannerComplete() {
    gameStore.completeBanner();
  }

  function handleResign() {
    const confirmed = confirm('Are you sure you want to resign from this game?');
    if (confirmed) {
      console.log('Player resigned');
      // TODO: Implement resignation logic
    }
  }

  // Battle animation helpers
  function startBattleTimeout(regionIndex: number) {
    const timeoutId = setTimeout(() => {
      clearBattleTimeout(regionIndex);
    }, 3000);

    battleTimeouts.set(regionIndex, timeoutId);
  }

  function clearBattleTimeout(regionIndex: number) {
    const timeoutId = battleTimeouts.get(regionIndex);
    if (timeoutId) {
      clearTimeout(timeoutId);
      battleTimeouts.delete(regionIndex);
    }
  }
</script>

  <!-- Turn Banner Overlay -->
{#if showBanner && $currentPlayerFromTurnManager}
  <Banner
    player={$currentPlayerFromTurnManager}
    isVisible={showBanner}
    onComplete={handleBannerComplete}
  />
{/if}

<LoadingState
  loading={$loading}
  error={$error}
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
        players={$players}
        currentPlayer={$currentPlayer}
        currentPlayerIndex={$currentPlayerIndex}
        movesRemaining={$movesRemaining}
        moveInstruction={gameStore.getMoveSystem()?.getCurrentInstruction() || ''}
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
        regions={$regions}
        gameState={$gameState}
        currentPlayer={$currentPlayer}
        selectedRegion={moveState.sourceRegion ? $regions.find(r => r.index === moveState.sourceRegion) : null}
        showTurnHighlights={highlightRegions}
        onRegionClick={handleRegionClick}
        previewMode={$loading || $turnState.isTransitioning}
        bind:mapContainer
      />
    </div>
  </div>

  {#if debugMode}
    <DebugUI
      gameState={$gameState}
      players={$players}
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
