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

  // Game state
  let gameState = writable<WorldConflictGameStateData | null>(null);
  let regions: Region[] = [];
  let players: Player[] = [];
  let loading = true;
  let error: string | null = null;

  // Move system state
  let moveMode: string = 'IDLE';
  let selectedRegion: number | null = null;
  let sourceRegion: number | null = null;
  let isMoving = false;
  let moveSystem: MoveSystem;

  // UI state
  let showSoldierSelection = false;
  let showInstructions = false;
  let audioEnabled = true;
  let soldierSelectionData: {
    maxSoldiers: number;
    currentSelection: number;
  } | null = null;

  // Player index for current user
  let playerIndex = -1;

  $: currentPlayerIndex = $gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: isMyTurn = currentPlayer?.id === playerId;
  $: movesRemaining = $gameState?.movesRemaining ?? 3;

  onMount(async () => {
    await initializeGame();
    startGamePolling();
  });

  onDestroy(() => {
    stopGamePolling();
  });

  let pollInterval: NodeJS.Timeout;

  async function initializeGame() {
    try {
      await loadGameState();

      // Initialize move system
      if ($gameState) {
        moveSystem = {
          // MoveSystem implementation would go here
          processAction: async (action: any) => {
            // Handle move actions
            await handleMoveAction(action);
          },
          handleRegionClick: async (regionIndex: number) => {
            await handleRegionClick(regionIndex);
          },
          getState: () => ({
            mode: moveMode,
            sourceRegion,
            selectedSoldierCount: 1,
            maxSoldiers: 0,
            availableMoves: movesRemaining,
            isMoving
          }),
          canSelectRegion: (regionIndex: number) => canSelectRegion(regionIndex),
          getRegionHighlight: (regionIndex: number) => getRegionHighlight(regionIndex),
          getCurrentInstruction: () => getCurrentInstruction()
        };
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
      regions = data.worldConflictState.regions;
      players = data.worldConflictState.players || [];

      // Find player index
      playerIndex = players.findIndex(p => p.id === playerId);

    } catch (err) {
      throw new Error('Failed to load game state');
    }
  }

  function startGamePolling() {
    pollInterval = setInterval(async () => {
      if (!loading && !error) {
        await loadGameState();
      }
    }, 2000);
  }

  function stopGamePolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  }

  // Enhanced move handling
  async function handleMoveAction(action: any) {
    switch (action.type) {
      case 'RESET':
        resetMoveState();
        break;
      case 'SELECT_SOURCE':
        await selectSourceRegion(action.payload?.regionIndex);
        break;
      case 'CANCEL':
        cancelMove();
        break;
    }
  }

  async function handleRegionClick(regionIndex: number) {
    if (!isMyTurn || !$gameState) return;

    switch (moveMode) {
      case 'IDLE':
      case 'SELECT_SOURCE':
        await selectSourceRegion(regionIndex);
        break;

      case 'ADJUST_SOLDIERS':
        if (regionIndex === sourceRegion) {
          // Show soldier selection modal
          const armyCount = getArmyCountAtRegion(regionIndex);
          soldierSelectionData = {
            maxSoldiers: Math.max(1, armyCount - 1),
            currentSelection: Math.min(Math.max(1, armyCount - 1), armyCount - 1)
          };
          showSoldierSelection = true;
        } else if (areRegionsAdjacent(sourceRegion!, regionIndex)) {
          // Direct move to adjacent region
          await executeMove(sourceRegion!, regionIndex, 1);
        }
        break;

      case 'SELECT_TARGET':
        if (areRegionsAdjacent(sourceRegion!, regionIndex)) {
          await executeMove(sourceRegion!, regionIndex, soldierSelectionData?.currentSelection || 1);
        }
        break;
    }
  }

  async function selectSourceRegion(regionIndex: number) {
    if (!isPlayerRegion(regionIndex)) return;

    const armyCount = getArmyCountAtRegion(regionIndex);
    if (armyCount <= 1) return;

    sourceRegion = regionIndex;
    selectedRegion = regionIndex;
    moveMode = 'ADJUST_SOLDIERS';
    isMoving = true;
  }

  async function executeMove(fromRegion: number, toRegion: number, soldierCount: number) {
    try {
      const response = await fetch(`/api/game/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          fromRegion,
          toRegion,
          soldierCount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Move failed');
      }

      await loadGameState();
      resetMoveState();

    } catch (err) {
      error = err instanceof Error ? err.message : 'Move failed';
    }
  }

  function resetMoveState() {
    moveMode = 'IDLE';
    selectedRegion = null;
    sourceRegion = null;
    isMoving = false;
    showSoldierSelection = false;
    soldierSelectionData = null;
  }

  function cancelMove() {
    resetMoveState();
  }

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

  // Helper functions
  function isPlayerRegion(regionIndex: number): boolean {
    return $gameState?.owners?.[regionIndex] === playerIndex;
  }

  function getArmyCountAtRegion(regionIndex: number): number {
    const soldiers = $gameState?.soldiersByRegion?.[regionIndex];
    return soldiers ? soldiers.length : 0;
  }

  function areRegionsAdjacent(sourceIndex: number, targetIndex: number): boolean {
    const sourceRegion = $gameState?.regions?.[sourceIndex];
    return sourceRegion?.neighbors?.includes(targetIndex) ?? false;
  }

  function canSelectRegion(regionIndex: number): boolean {
    switch (moveMode) {
      case 'IDLE':
      case 'SELECT_SOURCE':
        return isPlayerRegion(regionIndex) && getArmyCountAtRegion(regionIndex) > 1;
      case 'ADJUST_SOLDIERS':
      case 'SELECT_TARGET':
        return regionIndex === sourceRegion || areRegionsAdjacent(sourceRegion!, regionIndex);
      default:
        return false;
    }
  }

  function getRegionHighlight(regionIndex: number): 'source' | 'target' | 'available' | 'home' | 'none' {
    // Highlight home region for current player
    if (isCurrentPlayerHome(regionIndex)) return 'home';
    if (regionIndex === sourceRegion) return 'source';
    if (canSelectRegion(regionIndex)) return 'available';
    return 'none';
  }

  function isCurrentPlayerHome(regionIndex: number): boolean {
    // This would need to be tracked in game state - for now, highlight first owned region
    if (!isMyTurn || !$gameState) return false;
    const ownedRegions = Object.entries($gameState.owners || {})
      .filter(([_, owner]) => owner === playerIndex)
      .map(([region, _]) => parseInt(region));
    return ownedRegions.length > 0 && regionIndex === ownedRegions[0];
  }

  function getCurrentInstruction(): string {
    if (currentPlayer?.isAI) {
      return `${currentPlayer.name} is taking their turn.`;
    }

    switch (moveMode) {
      case 'SELECT_SOURCE':
        return 'Click on a region to move or attack with its army.';
      case 'ADJUST_SOLDIERS':
        return 'Click on this region again to choose how many to move.\nClick on a target region to move the army.';
      case 'SELECT_TARGET':
        return 'Click on a target region to move the army.';
      case 'BUILD':
        return 'Click on a temple to buy soldiers or upgrades.';
      default:
        return 'Click on a region to move or attack with its army.\nClick on a temple to buy soldiers or upgrades.';
    }
  }

  // Action handlers for the info panel
  function handleUndo() {
    cancelMove();
  }

  function handleToggleAudio() {
    audioEnabled = !audioEnabled;
    // Implement audio toggle logic
  }

  function handleShowInstructions() {
    showInstructions = true;
  }

  function handleResign() {
    if (confirm('Are you sure you want to resign?')) {
      // Implement resign logic
    }
  }

  function handleSoldierSelection(count: number) {
    if (soldierSelectionData) {
      soldierSelectionData.currentSelection = count;
      showSoldierSelection = false;
      moveMode = 'SELECT_TARGET';
    }
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
        highlightedRegions={$gameState?.regions?.map((_, index) => ({
          index,
          type: getRegionHighlight(index)
        })) || []}
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
    height: 100vh;
    width: 100%;
    text-align: center;
    padding: 2rem;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #475569;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-screen {
    color: #ef4444;
  }

  .retry-button {
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  /* Responsive design for mobile */
  @media (max-width: 768px) {
    .enhanced-game-container {
      flex-direction: column;
    }

    .map-container {
      height: calc(100vh - 300px);
    }
  }

  @media (max-width: 480px) {
    .enhanced-game-container {
      font-size: 0.9rem;
    }
  }
</style>
