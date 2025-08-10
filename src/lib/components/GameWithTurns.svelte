<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Banner from '$lib/components/ui/Banner.svelte';
  import Map from '$lib/components/configuration/Map.svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import { turnManager } from './TurnManager';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';

  // Props
  export let gameId: string;
  export let initialGameState: WorldConflictGameStateData;
  export let initialPlayers: Player[];
  export let currentPlayerId: string | null = null;

  // Local state
  let regions: Region[] = [];
  let selectedRegion: Region | null = null;
  let isLoading = false;

  // Subscribe to turn manager stores
  $: turnState = turnManager.state;
  $: currentPlayer = turnManager.currentPlayer;
  $: shouldShowBanner = turnManager.shouldShowBanner;
  $: shouldHighlightRegions = turnManager.shouldHighlightRegions;
  $: gameState = turnManager.gameData;

  // Reactive values from stores
  $: currentPlayerData = $currentPlayer;
  $: showBanner = $shouldShowBanner;
  $: highlightRegions = $shouldHighlightRegions;
  $: currentGameState = $gameState;

  onMount(async () => {
    // Initialize the turn manager with game data
    turnManager.initialize(initialGameState, initialPlayers);

    // Load regions (this would typically come from your region data)
    regions = initialGameState.regions || [];

    // Set up WebSocket or polling for real-time updates
    setupGameUpdates();
  });

  onDestroy(() => {
    // Clean up subscriptions and connections
    turnManager.reset();
  });

  /**
   * Set up real-time game updates (WebSocket or polling)
   */
  function setupGameUpdates(): void {
    // This would connect to your real-time update system
    // For now, using polling as an example
    const pollInterval = setInterval(async () => {
      try {
        await checkForGameUpdates();
      } catch (error) {
        console.error('Error checking for game updates:', error);
      }
    }, 2000);

    // Clean up on component destroy
    onDestroy(() => clearInterval(pollInterval));
  }

  /**
   * Check for game state updates from server
   */
  async function checkForGameUpdates(): Promise<void> {
    try {
      const response = await fetch(`/api/game/${gameId}/state`);
      if (response.ok) {
        const updatedGameState = await response.json();
        await handleGameStateUpdate(updatedGameState);
      }
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    }
  }

  /**
   * Handle incoming game state updates
   */
  async function handleGameStateUpdate(newGameState: WorldConflictGameStateData): Promise<void> {
    const currentState = $gameState;

    // Check if it's a new turn
    if (currentState && newGameState.playerIndex !== currentState.playerIndex) {
      // New player's turn - show banner and transition
      await turnManager.transitionToPlayer(newGameState.playerIndex, newGameState);
    } else {
      // Same player, just update state
      turnManager.updateGameState(newGameState);
    }
  }

  /**
   * Handle region clicks from the map
   */
  async function handleRegionClick(region: Region): Promise<void> {
    if (!currentPlayerData || !currentGameState) return;

    // Prevent actions during turn transition
    if ($turnState.isTransitioning) return;

    selectedRegion = region;

    // Check if this is the current player's turn
    if (currentGameState.playerIndex !== getCurrentPlayerIndex()) {
      showMessage("It's not your turn!");
      return;
    }

    // Handle region selection logic
    if (turnManager.isCurrentPlayerRegion(region.index)) {
      // Player clicked their own region
      await handleOwnRegionClick(region);
    } else {
      // Player clicked another region (potential move target)
      await handleTargetRegionClick(region);
    }
  }

  /**
   * Handle clicks on player's own regions
   */
  async function handleOwnRegionClick(region: Region): Promise<void> {
    const soldiers = currentGameState?.soldiersByRegion?.[region.index];
    const soldierCount = soldiers ? soldiers.length : 0;

    if (soldierCount <= 1) {
      showMessage("This region needs at least 2 soldiers to move armies!");
      return;
    }

    // Check if region has already moved this turn
    const hasMovedThisTurn = currentGameState?.conqueredRegions?.includes(region.index) ?? false;
    if (hasMovedThisTurn) {
      showMessage("This region has already moved this turn!");
      return;
    }

    // Open soldier selection or move interface
    // This would integrate with your existing move system
    console.log(`Selected region ${region.index} with ${soldierCount} soldiers`);
  }

  /**
   * Handle clicks on target regions for moves
   */
  async function handleTargetRegionClick(region: Region): Promise<void> {
    if (!selectedRegion) {
      showMessage("First select a region to move from!");
      return;
    }

    // Check if regions are adjacent
    if (!areRegionsAdjacent(selectedRegion.index, region.index)) {
      showMessage("Can only move to adjacent regions!");
      return;
    }

    // Execute the move
    await executeMove(selectedRegion.index, region.index);
  }

  /**
   * Execute a move between regions
   */
  async function executeMove(sourceIndex: number, targetIndex: number): Promise<void> {
    isLoading = true;

    try {
      const response = await fetch(`/api/game/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: sourceIndex,
          destination: targetIndex,
          count: 1, // This would come from soldier selection
          playerId: currentPlayerId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        await handleGameStateUpdate(result.gameState);
        selectedRegion = null;
      } else {
        const error = await response.json();
        showMessage(error.message || 'Move failed');
      }
    } catch (error) {
      console.error('Move execution failed:', error);
      showMessage('Failed to execute move');
    } finally {
      isLoading = false;
    }
  }

  /**
   * End the current player's turn
   */
  async function endTurn(): Promise<void> {
    if (!currentPlayerData || currentGameState?.playerIndex !== getCurrentPlayerIndex()) {
      showMessage("It's not your turn!");
      return;
    }

    isLoading = true;

    try {
      const response = await fetch(`/api/game/${gameId}/end-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: currentPlayerId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        await handleGameStateUpdate(result.gameState);
        selectedRegion = null;
      } else {
        const error = await response.json();
        showMessage(error.message || 'Failed to end turn');
      }
    } catch (error) {
      console.error('End turn failed:', error);
      showMessage('Failed to end turn');
    } finally {
      isLoading = false;
    }
  }

  /**
   * Show a temporary message to the player
   */
  function showMessage(message: string): void {
    // This would integrate with your notification system
    console.log('Game message:', message);
    // You could use a toast notification system here
  }

  /**
   * Check if two regions are adjacent
   */
  function areRegionsAdjacent(sourceIndex: number, targetIndex: number): boolean {
    const sourceRegion = regions.find(r => r.index === sourceIndex);
    return sourceRegion?.neighbors?.includes(targetIndex) ?? false;
  }

  /**
   * Get the current player's index
   */
  function getCurrentPlayerIndex(): number {
    return initialPlayers.findIndex(p => p.id === currentPlayerId);
  }

  /**
   * Handle turn banner completion
   */
  function handleBannerComplete(): void {
    turnManager.onBannerComplete();
  }

  /**
   * Force show turn banner (for testing or manual triggering)
   */
  function showBanner(): void {
    turnManager.showBanner();
  }
</script>

{#if showBanner && currentPlayerData}
  <Banner
    player={currentPlayerData}
    isVisible={showBanner}
    onComplete={handleBannerComplete}
  />
{/if}

<div class="game-container">
  <!-- Game Info Panel -->
  <div class="info-panel">
    <GameInfoPanel
      {gameState}
      players={initialPlayers}
      currentPlayer={currentPlayerData}
      onEndTurn={endTurn}
      {isLoading}
    />
  </div>

  <div class="map-container">
    <Map
      {regions}
      gameState={currentGameState}
      currentPlayer={currentPlayerData}
      {selectedRegion}
      showTurnHighlights={highlightRegions}
      onRegionClick={handleRegionClick}
      previewMode={isLoading || $turnState.isTransitioning}
    />
  </div>

  <!-- Debug Info (remove in production) -->
  {#if process.env.NODE_ENV === 'development'}
    <div class="debug-panel">
      <h4>Debug Info</h4>
      <p>Current Player: {currentPlayerData?.name || 'None'}</p>
      <p>Turn Transitioning: {$turnState.isTransitioning}</p>
      <p>Show Banner: {showBanner}</p>
      <p>Highlight Regions: {highlightRegions}</p>
      <button on:click={showBanner}>Test Banner</button>
    </div>
  {/if}
</div>

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

  .debug-panel {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1rem;
    font-size: 0.8rem;
    z-index: 1001;
    max-width: 200px;
  }

  .debug-panel h4 {
    margin: 0 0 0.5rem 0;
    color: #fbbf24;
  }

  .debug-panel p {
    margin: 0.25rem 0;
    color: #d1d5db;
  }

  .debug-panel button {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 0.7rem;
  }

  .debug-panel button:hover {
    background: #4b5563;
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
