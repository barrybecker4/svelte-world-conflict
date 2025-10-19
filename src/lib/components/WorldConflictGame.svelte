<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import TempleUpgradePanel from './TempleUpgradePanel.svelte';
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

  const gameStore = createGameStateStore(gameId, playerSlotIndex);
  const {
    gameState,
    regions,
    players,
    loading,
    error,
    currentPlayer,
    isMyTurn,
    shouldShowBanner,
    shouldHighlightRegions,
    completeBanner,
    eliminationBanners,
    completeEliminationBanner
  } = gameStore;

  const controller = new GameController(gameId, playerId, gameStore);
  const { modalState, moveState, isConnected } = controller.getStores();

  let mapContainer: HTMLElement;

  $: selectedRegion = $moveState.sourceRegion !== null
    ? $regions.find(r => r.index === $moveState.sourceRegion) || null
    : null;

  // Get valid target regions when a source is selected
  $: validTargetRegions = $moveState.sourceRegion !== null && gameStore.getMoveSystem()
    ? gameStore.getMoveSystem()?.getValidTargetRegions() ?? []
    : [];

  // Check for game end
  $: if ($gameState && $players.length > 0) {
    controller.checkGameEnd($gameState, $players);
  }

  $: moveMode = $moveState.mode;
  $: buildRegion = $moveState.buildRegion;
  $: inBuildMode = moveMode === 'BUILD' && buildRegion !== null;

  onMount(async () => {
    console.log('🎮 WorldConflictGame mounted');
    // Initialize without waiting for map container - it will be set later
    await controller.initialize(undefined);
  });

  // Set map container when it becomes available
  $: if (mapContainer) {
    console.log('🗺️ Map container available, setting in battle manager');
    controller.setMapContainer(mapContainer);
  }

  onDestroy(() => {
    controller.destroy();
  });

  function handlePlayAgain() {
    controller.destroy();
    window.location.href = '/';
  }
</script>

{#if $loading}
  <LoadingState loading={true} loadingText="Loading game..." />
{:else if $error}
  <div class="error-container">
    <h2>Error Loading Game</h2>
    <p>{$error}</p>
  </div>
{:else}
  <div class="game-container">
    <!-- Game Info Panel or Temple Upgrade Panel -->
    {#if inBuildMode && buildRegion !== null}
      <TempleUpgradePanel
        regionIndex={buildRegion}
        gameState={$gameState}
        currentPlayer={$currentPlayer}
        onPurchase={(upgradeIndex) => controller.purchaseUpgrade(buildRegion, upgradeIndex)}
        onDone={() => controller.closeTempleUpgradePanel()}
      />
    {:else}
      <GameInfoPanel
        gameState={$gameState}
        players={$players}
        playerSlotIndex={playerSlotIndex}
        moveMode={moveMode}
        onEndTurn={() => controller.endTurn()}
        onShowInstructions={() => controller.showInstructions()}
        onResign={() => controller.resign()}
      />
    {/if}

    <!-- Game Map -->
    <div class="map-wrapper" bind:this={mapContainer}>
      <GameMap
        regions={$regions}
        currentPlayer={$currentPlayer ?? null}
        {selectedRegion}
        {validTargetRegions}
        gameState={$gameState}
        showTurnHighlights={$shouldHighlightRegions ?? true}
        onRegionClick={(region) => {
          console.log('🗺️ GameMap click received in component:', { region, isMyTurn: $isMyTurn });
          controller.handleRegionClick(region, $isMyTurn ?? false);
        }}
        onTempleClick={(regionIndex) => {
          console.log('🏛️ Temple click received in component:', { regionIndex, isMyTurn: $isMyTurn });
          controller.handleTempleClick(regionIndex, $isMyTurn ?? false);
        }}
      />
    </div>

    <!-- Turn Banner -->
    {#if $shouldShowBanner && $currentPlayer}
      <Banner player={$currentPlayer} onComplete={completeBanner} />
    {/if}

    <!-- Elimination Banners -->
    {#each $eliminationBanners as eliminatedPlayerSlot (eliminatedPlayerSlot)}
      {@const eliminatedPlayer = $players.find(p => p.slotIndex === eliminatedPlayerSlot)}
      {#if eliminatedPlayer}
        <Banner
          player={eliminatedPlayer}
          type="elimination"
          duration={2000}
          onComplete={() => completeEliminationBanner(eliminatedPlayerSlot)}
        />
      {/if}
    {/each}

    <!-- Modals -->
    {#if $modalState.showSoldierSelection && $modalState.soldierSelectionData}
      <SoldierSelectionModal
        maxSoldiers={$modalState.soldierSelectionData.maxSoldiers}
        currentSelection={$modalState.soldierSelectionData.currentSelection}
        onConfirm={(count) => controller.confirmSoldierSelection(count)}
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
        WS: {$isConnected ? 'Connected' : 'Disconnected'} | Mode: {$moveState.mode}
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
