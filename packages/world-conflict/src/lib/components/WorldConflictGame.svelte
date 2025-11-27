<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import GameInfoPanel from './GameInfoPanel.svelte';
  import GameSummaryPanel from './GameSummaryPanel.svelte';
  import TempleUpgradePanel from './TempleUpgradePanel.svelte';
  import GameMap from './map/GameMap.svelte';
  import SoldierSelectionModal from './modals/SoldierSelectionModal.svelte';
  import GameInstructions from './modals/GameInstructionsModal.svelte';
  import LoadingState from './ui/LoadingState.svelte';
  import Banner from './ui/Banner.svelte';
  import { createGameStateStore } from '$lib/client/stores/gameStateStore';
  import { GameController } from '$lib/client/gameController/GameController';
  import type { Player } from '$lib/game/state/GameState';
  import { BUILD } from '$lib/game/mechanics/moveConstants';
  import { logger } from '$lib/client/utils/logger';

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
    currentPlayerFromTurnManager,
    isMyTurn,
    shouldShowBanner,
    shouldHighlightRegions,
    completeBanner,
    eliminationBanners,
    completeEliminationBanner,
    shouldShowReplayBanner,
    replayPlayer,
    completeReplayBanner
  } = gameStore;

  const controller = new GameController(gameId, playerId, gameStore);
  const { modalState, moveState, isConnected, tutorialTips } = controller.getStores();

  let mapContainer: HTMLElement;
  let showVictoryBanner = false;
  let showGameSummary = false;
  let gameWinner: Player | 'DRAWN_GAME' | null = null;

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

  // Show victory banner when game ends
  $: if ($gameState && $players.length > 0 && $modalState.showGameSummary && !showVictoryBanner && !showGameSummary) {
    // Game just ended, show victory banner
    showVictoryBanner = true;
    gameWinner = $modalState.winner;
  }

  $: moveMode = $moveState.mode;
  $: buildRegion = $moveState.buildRegion;
  $: inBuildMode = moveMode === BUILD && buildRegion !== null;
  // canUndo needs to react to gameState changes, so we reference $gameState to create the dependency
  $: canUndo = $gameState ? controller.canUndo() : false;

  onMount(async () => {
    logger.debug('WorldConflictGame mounted');
    // Initialize without waiting for map container - it will be set later
    await controller.initialize(undefined);
  });

  // Set map container when it becomes available
  $: if (mapContainer) {
    logger.debug('Map container available, setting in battle manager');
    controller.setMapContainer(mapContainer);
  }

  onDestroy(() => {
    controller.destroy();
  });

  function handlePlayAgain() {
    controller.destroy();
    window.location.href = '/';
  }

  function handleVictoryBannerComplete() {
    logger.debug('Victory banner completed, showing summary panel');
    showVictoryBanner = false;
    showGameSummary = true;
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
  <div class="game-container" data-testid="game-interface">
    <!-- Game Info Panel, Temple Upgrade Panel, or Game Summary Panel -->
    {#if showGameSummary && $gameState}
      <GameSummaryPanel
        gameState={$gameState}
        players={$players}
        winner={gameWinner}
        onPlayAgain={handlePlayAgain}
      />
    {:else if inBuildMode && buildRegion !== null}
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
        onUndo={() => controller.undo()}
        canUndo={canUndo}
        onShowInstructions={() => controller.showInstructions()}
        onResign={() => controller.resign()}
      />
    {/if}

    <!-- Game Map -->
    <div class="map-wrapper" bind:this={mapContainer} data-testid="game-map">
      <GameMap
        regions={$regions}
        currentPlayer={$currentPlayer ?? null}
        {selectedRegion}
        {validTargetRegions}
        gameState={$gameState}
        showTurnHighlights={($shouldHighlightRegions ?? true) && !$gameState?.endResult}
        tutorialTips={$tutorialTips}
        onRegionClick={(region) => {
          logger.debug('GameMap click received in component:', { region, isMyTurn: $isMyTurn });
          controller.handleRegionClick(region, $isMyTurn ?? false);
        }}
        onTempleClick={(regionIndex) => {
          logger.debug('Temple click received in component:', { regionIndex, isMyTurn: $isMyTurn });
          controller.handleTempleClick(regionIndex, $isMyTurn ?? false);
        }}
        onDismissTooltip={(tooltipId) => controller.dismissTooltip(tooltipId)}
      />
    </div>

    <!-- Replay Banner - shows before replaying other players' moves -->
    {#if $shouldShowReplayBanner && $replayPlayer}
      <Banner player={$replayPlayer} onComplete={completeReplayBanner} />
    {/if}

    <!-- Turn Banner - shows when it's the local player's turn -->
    {#if $shouldShowBanner && $currentPlayerFromTurnManager}
      <Banner player={$currentPlayerFromTurnManager} onComplete={completeBanner} />
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

    <!-- Victory Banner -->
    {#if showVictoryBanner}
      <Banner
        player={null}
        type="victory"
        winner={gameWinner}
        duration={3000}
        onComplete={handleVictoryBannerComplete}
      />
    {/if}

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
      <GameInstructions onclose={() => controller.closeInstructions()} />
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
    bottom: 8px;
    left: 8px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #cbd5e1;
    font-size: 0.75rem;
    border-radius: 6px;
    z-index: 1001;
  }
</style>
