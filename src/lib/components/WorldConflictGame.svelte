<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameMap from './map/GameMap.svelte';
  import SoldierSelectionModal from './modals/SoldierSelectionModal.svelte';
  import GameInstructions from './modals/GameInstructionsModal.svelte';
  import GameSummaryModal from './modals/GameSummaryModal.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Button from './ui/Button.svelte';
  import Banner from './ui/Banner.svelte';
  import type { MoveState } from '$lib/gamemechanics/moveTypes';
  import { MoveSystem } from '$lib/game/mechanics/MoveSystem';
  import { GameWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';
  import { createGameStateStore } from '$lib/client/stores/gameStateStore';
  import { BattleManager, type BattleMove } from '$lib/client/rendering/BattleManager';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { checkGameEnd, type GameEndResult } from '$lib/game/mechanics/endGameLogic';

  export let gameId: string;
  export let playerId: string;
  export let playerSlotIndex: number;

  // destructure the individual stores
  const gameStore = createGameStateStore(gameId, playerId, playerSlotIndex);
  const {
    gameState,
    regions,
    players,
    loading,
    error,
    currentPlayerSlot,
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

  let battleManager: BattleManager;
  let mapContainer: HTMLElement;

  // UI state
  let showSoldierSelection = false;
  let showInstructions = false;
  let showGameSummary = false;
  let gameEndResult: GameEndResult | null = null;
  let soldierSelectionData: {
    maxSoldiers: number;
    currentSelection: number;
  } | null = null;

  // WebSocket client
  let wsClient: GameWebSocketClient | null = null;

  // UI reactive variables
  $: moveMode = moveState.mode;
  $: selectedRegion = moveState.sourceRegion;
  $: showBanner = $shouldShowBanner;
  $: highlightRegions = $shouldHighlightRegions;
  $: connectionStatus = wsClient?.isConnected() ? 'Connected' : 'Disconnected';

  // Watch for game end conditions
  $: if ($gameState && $players.length > 0) {
    checkForGameEnd();
  }

  $: {
    if (mapContainer && battleManager) {
      battleManager.setMapContainer(mapContainer);
    }
  }

  onMount(async () => {
    console.log('🎮 WorldConflict Game mounting with:', { gameId, playerId, playerSlotIndex });
    battleManager = new BattleManager(gameId, mapContainer);
    await gameStore.initializeGame(handleMoveComplete, handleMoveStateChange);
    await initializeWebSocket();
    await audioSystem.initializeAudio();
  });

  onDestroy(() => {
    battleManager?.destroy();
    cleanupWebSocket();
    gameStore.resetTurnManager();
  });

  async function initializeWebSocket() {
    try {
      wsClient = new GameWebSocketClient();

      wsClient.onGameUpdate((gameData) => {
        console.log('Received game update via WebSocket:', gameData);
        gameStore.handleGameStateUpdate(gameData);
      });

      wsClient.onConnected(() => {
        console.log('Connected to game WebSocket');
      });

      wsClient.onDisconnected(() => {
        console.log('Disconnected from game WebSocket');
      });

      wsClient.onError((error) => {
        console.error('WebSocket error:', error);
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
      const battleMove: BattleMove = {
        sourceRegionIndex,
        targetRegionIndex,
        soldierCount,
        gameState: currentState
      };

      // Update local state for immediate UI feedback if it's a battle
      if (battleManager.isBattleRequired(battleMove)) {
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

      const result = await battleManager.executeMove(battleMove, playerId, $regions);

      if (!result.success) {
        throw new Error(result.error || 'Move execution failed');
      }

      // Update game state with server response
      if (result.gameState) {
        console.log('Updating game state with server response');
        gameState.set(result.gameState);
      } else {
        // Clear any temporary battle states if no gameState in response
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

  function handleRegionClick(region: any) {
    console.log('Region clicked:', region);

    // Check if it's my turn AND the current player is not an AI
    if (!$isMyTurn) {
      console.log('Not my turn or current player is AI, ignoring click');
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
    if (!$isMyTurn) {
      console.log('Cannot end turn: not my turn');
      return;
    }

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

  function checkForGameEnd() {
    if (!$gameState || gameEndResult) return;

    const endResult = checkGameEnd($gameState, $players);

    if (endResult.isGameEnded) {
      console.log('🏁 Game ended:', endResult);
      gameEndResult = endResult;

      // Hide the turn banner immediately when game ends
      showBanner = false;

      // Show summary after a brief delay
      setTimeout(() => {
        showGameSummary = true;
      }, 2000);
    }
  }

  function handleUndo() {
    if (!$isMyTurn) return;
    gameStore.getMoveSystem().undo();
  }

  function handleCancelMove() {
    gameStore.getMoveSystem().cancelCurrentMove();
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleBannerComplete() {
    gameStore.completeBanner();
  }

  function handleRetry() {
    gameStore.initializeGame(handleMoveComplete, handleMoveStateChange);
  }

  async function handleResign() {
    const confirmed = confirm('Are you sure you want to resign? This will end the game for you.');
    if (!confirmed) return;

    console.log('Player resigned from ', gameId);

    const response = await fetch(`/api/game/${gameId}/quit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerId: playerId,
        reason: 'RESIGN'
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Resignation successful:', result);

      // Clean up WebSocket connection
      cleanupWebSocket();

      // Redirect to home page after resignation
      // Using window.location instead of goto() to ensure clean navigation
      window.location.href = '/';

    } else {
      const error = await response.json();
      console.error('Failed to resign:', error);
      alert(error.message || 'Failed to resign from game');
    }
  }

  function handlePlayAgain() {
    cleanupWebSocket();
    window.location.href = '/';
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

{#if showGameSummary && gameEndResult && $gameState}
  <GameSummaryModal
    gameState={$gameState}
    players={$players}
    winner={gameEndResult.winner}
    isVisible={showGameSummary}
    on:playAgain={handlePlayAgain}
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
        currentPlayerSlot={$currentPlayerSlot}
        movesRemaining={$movesRemaining}
        moveInstruction={gameStore.getMoveSystem()?.getCurrentInstruction() || ''}
        showCancelButton={moveState.mode !== 'IDLE'}
        onEndTurn={handleEndTurn}
        onUndo={handleUndo}
        onCancelMove={handleCancelMove}
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
        previewMode={$loading}
        bind:mapContainer
      />
    </div>
  </div>

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
