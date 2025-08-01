<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import Map from './configuration/Map.svelte';
  import SoldierSelectionModal from './SoldierSelectionModal.svelte';
  import GameInstructions from './GameInstructions.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Button from './ui/Button.svelte';
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';
  import { MoveSystem, type MoveState } from '$lib/game/classes/MoveSystem';
  import { GameWebSocketClient } from '$lib/multiplayer/websocket/client';

  // Props
  export let gameId: string;
  export let playerId: string;
  export let playerIndex: number;

  // Game state
  let gameState = writable<WorldConflictGameStateData | null>(null);
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

  // UI state
  let showSoldierSelection = false;
  let showInstructions = false;
  let audioEnabled = true;
  let soldierSelectionData: {
    maxSoldiers: number;
    currentSelection: number;
  } | null = null;

  // Reactive values
  $: currentPlayerIndex = $gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: isMyTurn = currentPlayerIndex === playerIndex;
  $: movesRemaining = $gameState?.movesRemaining ?? 3;
  $: moveMode = moveState.mode;
  $: selectedRegion = moveState.sourceRegion;

  let wsClient: GameWebSocketClient | null = null;

  onMount(async () => {
    await initializeGame();
    await initializeWebSocket();
  });

  onDestroy(() => {
    cleanupWebSocket();
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

      // Set up event handlers
      wsClient.onGameUpdate((gameData) => {
        console.log('🎮 Received game update via WebSocket');
        gameState.set(gameData.worldConflictState);
        regions = gameData.worldConflictState.regions || [];
        players = gameData.worldConflictState.players || [];

        // Update move system if it exists
        if (moveSystem && $gameState) {
          moveSystem = new MoveSystem(
            $gameState,
            handleMoveComplete,
            handleMoveStateChange
          );
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

  // Move system callbacks
  function handleMoveStateChange(newState: MoveState) {
    moveState = { ...newState };

    if (newState.mode === 'ADJUST_SOLDIERS') {
      soldierSelectionData = {
        maxSoldiers: newState.maxSoldiers,
        currentSelection: newState.selectedSoldierCount
      };
      showSoldierSelection = true;
    }
  }

  async function handleMoveComplete(from: number, to: number, soldiers: number) {
    try {
      const response = await fetch(`/api/game/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          from,
          to,
          soldiers
        })
      });

      if (!response.ok) {
        throw new Error('Move failed');
      }

      showSoldierSelection = false;
      soldierSelectionData = null;

      // Game state will be updated via WebSocket
    } catch (err) {
      console.error('Move failed:', err);
      error = 'Move failed. Please try again.';
    }
  }

  function handleSoldierSelection(count: number) {
    if (moveSystem) {
      moveSystem.processAction({
        type: 'ADJUST_SOLDIERS',
        payload: { soldierCount: count }
      });
    }
    showSoldierSelection = false;
  }

  // Game action handlers
  async function handleEndTurn() {
    try {
      const response = await fetch(`/api/game/${gameId}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        throw new Error('Failed to end turn');
      }
    } catch (err) {
      console.error('End turn failed:', err);
      error = 'Failed to end turn. Please try again.';
    }
  }

  function handleCancelMove() {
    if (moveSystem) {
      moveSystem.processAction({ type: 'CANCEL' });
    }
    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  function handleUndo() {
    // Implement undo logic
  }

  function handleToggleAudio() {
    audioEnabled = !audioEnabled;
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleResign() {
    // Implement resign logic
  }

  function handleRegionClick(regionIndex: number) {
    if (!isMyTurn || !moveSystem) return;

    moveSystem.processAction({
      type: 'SELECT_SOURCE',
      payload: { regionIndex }
    });
  }
</script>

<div class="enhanced-game-container">
  <LoadingState
    {loading}
    {error}
    loadingText="Loading World Conflict..."
    containerClass="fullscreen"
    showRetry={true}
    on:retry={handleRetry}
  >
    <svelte:fragment slot="error-actions">
      <Button variant="secondary" on:click={() => window.location.href = '/'}>
        Return to Home
      </Button>
    </svelte:fragment>

    <GameInfoPanel
      {gameState}
      {players}
      {moveMode}
      {selectedRegion}
      {audioEnabled}
      onEndTurn={handleEndTurn}
      onCancelMove={handleCancelMove}
      onUndo={handleUndo}
      onToggleAudio={handleToggleAudio}
      onShowInstructions={handleShowInstructions}
      onResign={handleResign}
    />

    <div class="map-container">
      <Map
        {regions}
        {players}
        gameState={$gameState}
        {moveMode}
        {selectedRegion}
        onRegionClick={handleRegionClick}
        playerIndex={playerIndex}
      />
    </div>

    {#if showSoldierSelection && soldierSelectionData}
      <SoldierSelectionModal
        maxSoldiers={soldierSelectionData.maxSoldiers}
        currentSelection={soldierSelectionData.currentSelection}
        onConfirm={handleSoldierSelection}
        onCancel={() => showSoldierSelection = false}
      />
    {/if}

    {#if showInstructions}
      <GameInstructions
        onClose={() => showInstructions = false}
      />
    {/if}
  </LoadingState>
</div>

<style>
  .enhanced-game-container {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>