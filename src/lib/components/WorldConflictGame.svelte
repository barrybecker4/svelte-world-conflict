<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import Map from './configuration/Map.svelte';
  import SoldierSelectionModal from './SoldierSelectionModal.svelte';
  import GameInstructions from './GameInstructions.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Button from './ui/Button.svelte';
  import Banner from './ui/Banner.svelte';
  import { turnManager } from '$lib/game/TurnManager';

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

  $: console.log('WebSocket status:', {
    wsClient: !!wsClient,
    isConnected: wsClient?.isConnected(),
    gameId,
    playerId,
    playerIndex
  });

  let wsClient: GameWebSocketClient | null = null;

  onMount(async () => {
    await initializeGame();
    await initializeWebSocket();
  });

  onDestroy(() => {
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

          gameState.set(worldConflictState); // update reactive gameState

          regions = worldConflictState.regions || [];
          players = worldConflictState.players || [];

          if (isNewTurn) {
            // New player's turn - show banner and transition
            turnManager.transitionToPlayer(worldConflictState.playerIndex, worldConflictState);
          } else {
            // Same player, just update state
            turnManager.updateGameState(worldConflictState);
          }

          // Update the existing move system with new game state
          if (moveSystem) {
            moveSystem.updateGameState(worldConflictState);
          } else {
            // Only create new MoveSystem if it doesn't exist
            moveSystem = new MoveSystem(
              worldConflictState,
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
        throw new Error('Failed to process move');
      }

      const result = await response.json();
      console.log('✅ Move processed successfully:', result);

      // Update local state with server response
      if (result.gameState) {
        console.log('Updating game state with server response. gameState.owners = ', result.gameState.owners);
        gameState.set(result.gameState);
      }

      // The authoritative update from WebSocket will override temporary state

    } catch (error) {
      console.error('❌ Move failed:', error);

      // Clear any temporary battle states on error
      if ($gameState) {
        const cleanState = {
          ...$gameState,
          battlesInProgress: [],
          pendingMoves: []
        };
        gameState.set(cleanState);
      }

      throw error;
    }
  }

  function updateLocalState(currentState: WorldConflictGameStateData,
                            sourceRegionIndex: number, targetRegionIndex: number, soldierCount: number) {
    const targetSoldiers = currentState.soldiersByRegion?.[targetRegionIndex] || [];
    const isHostileTerritory = targetSoldiers.length > 0 &&
                              currentState.owners[targetRegionIndex] !== playerIndex;

    if (isHostileTerritory) {
      // Show battle in progress without claiming territory
      console.log('⚔️ Battle starting at region', targetRegionIndex);

      const battleState = {
        ...currentState,
        battlesInProgress: [...(currentState.battlesInProgress || []), targetRegionIndex],
        // Optionally show soldier movement without ownership change
        pendingMoves: [
          ...(currentState.pendingMoves || []),
          { from: sourceRegionIndex, to: targetRegionIndex, count: soldierCount }
        ]
      };

      gameState.set(battleState);
    } else {
      // Moving to neutral/friendly territory - safe to show movement immediately
      console.log('🚶 Moving to neutral/friendly territory');
      const moveState = {
        ...currentState,
        soldiersByRegion: {
          ...currentState.soldiersByRegion,
          [sourceRegionIndex]: (currentState.soldiersByRegion?.[sourceRegionIndex] || []).slice(soldierCount),
          [targetRegionIndex]: [
            ...(currentState.soldiersByRegion?.[targetRegionIndex] || []),
            ...Array(soldierCount).fill({ playerId: playerIndex })
          ]
        }
      };

      if (targetSoldiers.length === 0 && !currentState.owners[targetRegionIndex]) {
        // Safe to claim neutral territory immediately
        moveState.owners = {
          ...currentState.owners,
          [targetRegionIndex]: playerIndex
        };
      }

      gameState.set(moveState);
    }
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

  function handleSoldierSelectionConfirm(soldierCount: number) {
    //const { soldierCount } = event.detail;
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

<!-- ADD THIS: Turn Banner Overlay -->
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

    <!-- Right Panel: Game Map -->
    <div class="map-container">
      <Map
        {regions}
        gameState={$gameState}
        currentPlayer={currentPlayer}
        selectedRegion={moveState.sourceRegion ? regions.find(r => r.index === moveState.sourceRegion) : null}
        showTurnHighlights={highlightRegions}
        onRegionClick={handleRegionClick}
        previewMode={loading || $turnState.isTransitioning}
      />
    </div>
  </div>

  <!-- Soldier Selection Modal -->
  {#if showSoldierSelection && soldierSelectionData}
    <SoldierSelectionModal
      maxSoldiers={soldierSelectionData.maxSoldiers}
      currentSelection={soldierSelectionData.currentSelection}
      onConfirm={handleSoldierSelectionConfirm}
      onCancel={handleSoldierSelectionCancel}
    />
  {/if}

  <!-- Instructions Modal -->
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
