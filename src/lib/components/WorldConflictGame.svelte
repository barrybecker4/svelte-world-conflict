<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameMap from './configuration/GameMap.svelte';
  import SoldierSelectionModal from './SoldierSelectionModal.svelte';
  import GameInstructions from './GameInstructions.svelte';
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';
  import { MoveSystem, type MoveState } from '$lib/game/classes/MoveSystem';

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

  let pollInterval: NodeJS.Timeout;

  onMount(async () => {
    await initializeGame();
    startGamePolling();
  });

  onDestroy(() => {
    stopGamePolling();
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

  function startGamePolling() {
    pollInterval = setInterval(async () => {
      if (!loading && !error) {
        try {
          await loadGameState();
        } catch (err) {
          console.warn('Failed to poll game state:', err);
        }
      }
    }, 2000);
  }

  function stopGamePolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  }

  // Move system callbacks
  function handleMoveStateChange(newState: MoveState) {
    moveState = { ...newState };

    // Handle soldier selection modal
    if (newState.mode === 'ADJUST_SOLDIERS' && newState.maxSoldiers > 1) {
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

  async function handleMoveComplete(from: number, to: number, soldiers: number) {
    try {
      const response = await fetch(`/api/game/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          moveType: 'ARMY_MOVE',
          source: from,
          destination: to,
          count: soldiers
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Move failed');
      }

      await loadGameState();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Move failed';
      throw err; // Re-throw so MoveSystem knows the move failed
    }
  }

  // Region click handler - this is the key fix for the move system
  async function handleRegionClick(regionIndex: number) {
    if (!isMyTurn || !moveSystem) return;

    try {
      await moveSystem.handleRegionClick(regionIndex);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Action failed';
    }
  }

  // Soldier selection handler
  function handleSoldierSelection(count: number) {
    if (soldierSelectionData && moveSystem) {
      soldierSelectionData.currentSelection = count;
      showSoldierSelection = false;

      // Update the move system with the selected soldier count
      moveSystem.processAction({
        type: 'ADJUST_SOLDIERS',
        payload: { soldierCount: count }
      });

      // Move to target selection mode
      moveSystem.processAction({
        type: 'SELECT_TARGET'
      });
    }
  }

  // Action handlers
  async function endTurn() {
    try {
      const response = await fetch(`/api/game/${gameId}/end-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to end turn');
      }

      await loadGameState();
      resetMoveState();

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to end turn';
    }
  }

  function resetMoveState() {
    if (moveSystem) {
      moveSystem.processAction({ type: 'RESET' });
    }
  }

  function cancelMove() {
    if (moveSystem) {
      moveSystem.processAction({ type: 'CANCEL' });
    }
  }

  function handleUndo() {
    // For now, just cancel current move
    cancelMove();
  }

  function handleToggleAudio() {
    audioEnabled = !audioEnabled;
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleResign() {
    if (confirm('Are you sure you want to resign?')) {
      // TODO: Implement resign logic
      console.log('Resign requested');
    }
  }

  // Helper functions for highlighting
  function getRegionHighlight(regionIndex: number): 'source' | 'target' | 'available' | 'home' | 'none' {
    if (!moveSystem) return 'none';

    const highlight = moveSystem.getRegionHighlight(regionIndex);

    // Add home region highlighting for current player
    if (highlight === 'none' && isCurrentPlayerHome(regionIndex)) {
      return 'home';
    }

    return highlight;
  }

  function isCurrentPlayerHome(regionIndex: number): boolean {
    if (!isMyTurn || !$gameState) return false;

    // Find the first owned region as "home"
    const ownedRegions = Object.entries($gameState.owners || {})
      .filter(([_, owner]) => owner === playerIndex)
      .map(([region, _]) => parseInt(region));

    return ownedRegions.length > 0 && regionIndex === ownedRegions[0];
  }

  function getCurrentInstruction(): string {
    if (!moveSystem) return 'Loading...';

    if (!isMyTurn) {
      return `${currentPlayer?.name || 'Player'} is taking their turn.`;
    }

    return moveSystem.getCurrentInstruction();
  }
</script>

<div class="enhanced-game-container">
  {#if loading}
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>Loading World Conflict...</p>
    </div>
  {:else if error}
    <div class="error-screen">
      <h3>Game Error</h3>
      <p>{error}</p>
      <button on:click={() => error = null} class="retry-button">Retry</button>
    </div>
  {:else}
    <!-- Enhanced Game Info Panel -->
    <GameInfoPanel
      gameState={$gameState}
      {players}
      onEndTurn={endTurn}
      onCancelMove={cancelMove}
      onUndo={handleUndo}
      onToggleAudio={handleToggleAudio}
      onShowInstructions={handleShowInstructions}
      onResign={handleResign}
      {moveMode}
      {selectedRegion}
      {audioEnabled}
    />

    <!-- Game Map -->
    <div class="map-container">
      <GameMap
        {regions}
        gameState={$gameState}
        onRegionClick={handleRegionClick}
        selectedRegion={selectedRegion}
        highlightedRegions={regions.map((_, index) => ({
          index,
          type: getRegionHighlight(index)
        }))}
        {moveMode}
      />
    </div>

    <!-- Soldier Selection Modal -->
    {#if showSoldierSelection && soldierSelectionData}
      <SoldierSelectionModal
        maxSoldiers={soldierSelectionData.maxSoldiers}
        currentSelection={soldierSelectionData.currentSelection}
        onConfirm={handleSoldierSelection}
        onCancel={() => showSoldierSelection = false}
      />
    {/if}

    <!-- Instructions Modal -->
    {#if showInstructions}
      <GameInstructions
        onClose={() => showInstructions = false}
      />
    {/if}
  {/if}
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

  .loading-screen, .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #374151;
    border-top: 4px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-screen h3 {
    color: #ef4444;
    margin-bottom: 16px;
  }

  .retry-button {
    padding: 8px 16px;
    background: #60a5fa;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 16px;
  }

  .retry-button:hover {
    background: #3b82f6;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>
