<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameMap from './map/GameMap.svelte';
  import SoldierSelectionModal from './modals/SoldierSelectionModal.svelte';
  import GameInstructions from './modals/GameInstructionsModal.svelte';
  import GameSummaryModal from './modals/gameSummary/GameSummaryModal.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Banner from './ui/Banner.svelte';
  import { createGameStateStore } from '$lib/client/stores/gameStateStore';
  import { GameController } from '$lib/client/controllers/GameController';

  export let gameId: string;
  export let playerId: string;
  export let playerSlotIndex: number;

  const gameStore = createGameStateStore(gameId, playerId, playerSlotIndex);
  const {
    gameState,
    regions,
    players,
    loading,
    error,
    currentPlayer,
    isMyTurn,
    shouldShowBanner,
    shouldHighlightRegions
  } = gameStore;

  const controller = new GameController(gameId, playerId, gameStore);
  const { modalState, moveState, isConnected } = controller.getStores();

  let mapContainer: HTMLElement;

  $: selectedRegion = $moveState.sourceRegion !== null ? { index: $moveState.sourceRegion } : null;

  // Check for game end
  $: if ($gameState && $players.length > 0) {
    controller.checkGameEnd($gameState, $players);
  }

  onMount(async () => {
    await controller.initialize(mapContainer);
  });

  onDestroy(() => {
    controller.destroy();
  });

  function handlePlayAgain() {
    controller.destroy();
    window.location.href = '/';
  }
</script>

{#if $loading}
  <LoadingState message="Loading game..." />
{:else if $error}
  <div class="error-container">
    <h2>Error Loading Game</h2>
    <p>{$error}</p>
  </div>
{:else}
  <div class="game-container">
    <!-- Game Info Panel -->
    <GameInfoPanel
      gameState={$gameState}
      players={$players}
      moveMode={$moveState.mode}
      onEndTurn={() => {
        console.log('🎯 End turn button clicked in component');
        controller.endTurn();
      }}
      onShowInstructions={() => controller.showInstructions()}
      onResign={() => controller.resign()}
    />

    <!-- Game Map -->
    <div class="map-wrapper" bind:this={mapContainer}>
      <GameMap
        regions={$regions}
        players={$players}
        currentPlayer={$currentPlayer}
        moveMode={$moveState.mode}
        {selectedRegion}
        gameState={$gameState}
        showTurnHighlights={$shouldHighlightRegions}
        onRegionClick={(region) => {
          console.log('🗺️ GameMap click received in component:', { region, isMyTurn: $isMyTurn });
          controller.handleRegionClick(region, $isMyTurn);
        }}
      />
    </div>

    <!-- Turn Banner -->
    {#if $shouldShowBanner && $currentPlayer}
      <Banner player={$currentPlayer} />
    {/if}

    <!-- Modals -->
    {#if $modalState.showSoldierSelection && $modalState.soldierSelectionData}
      <SoldierSelectionModal
        maxSoldiers={$modalState.soldierSelectionData.maxSoldiers}
        currentSelection={$modalState.soldierSelectionData.currentSelection}
        onConfirm={(count) => controller.handleSoldierCountChange(count) || controller.confirmSoldierSelection()}
        onCancel={() => controller.cancelSoldierSelection()}
      />
    {/if}

    {#if $modalState.showInstructions}
      <GameInstructions on:close={() => controller.closeInstructions()} />
    {/if}

    {#if $modalState.showGameSummary && $gameState}
      <GameSummaryModal
        gameState={$gameState}
        players={$players}
        winner={$modalState.winner}
        isVisible={$modalState.showGameSummary}
        on:playAgain={handlePlayAgain}
      />
    {/if}

    {#if import.meta.env.DEV}
      <div class="debug-info">
        WS: {isConnected() ? 'Connected' : 'Disconnected'} | Mode: {$moveState.mode}
      </div>
    {/if}
  </div>
{/if}

<style>
  .game-container {
    display: flex;
    height: 100vh;
    background: var(--bg-page);
  }

  .map-wrapper {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: var(--space-6);
    text-align: center;
  }

  .debug-info {
    position: fixed;
    bottom: var(--space-2);
    right: var(--space-2);
    padding: var(--space-2);
    background: rgba(0, 0, 0, 0.7);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    border-radius: var(--radius-md);
  }
</style>
