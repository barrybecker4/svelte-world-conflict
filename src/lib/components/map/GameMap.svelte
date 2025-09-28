<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import { getPlayerMapColor, getPlayerHighlightColor } from '$lib/game/constants/playerConfigs';
  import SvgDefinitions from './SvgDefinitions.svelte';
  import RegionRenderer from './RegionRenderer.svelte';

  export let regions: Region[] = [];
  export let gameState: GameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;
  export let isPreviewMode = false;
  export let showTurnHighlights: boolean = true;
  export let previewMode: boolean = false;
  export let mapContainer: HTMLElement | undefined = undefined;

  const NEUTRAL_COLOR = '#8b92a0';

  let mapContainerElement: HTMLDivElement;
  let highlightVisible = true;
  let battlesInProgress = new Set<number>();

  // Bind the internal element to the exported prop
  $: if (mapContainerElement && !mapContainer) {
    mapContainer = mapContainerElement;
  }

  $: currentTurnPlayer = gameState?.players?.find(p => p.slotIndex === gameState.currentPlayerSlot) || null;

  // Auto-detect preview mode
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode || previewMode;

  // Update battles in progress
  $: {
    if (gameState?.battlesInProgress) {
      battlesInProgress = new Set(gameState.battlesInProgress);
    }
  }

  onMount(() => {
    // Start the highlight pulse animation
    const interval = setInterval(() => {
      highlightVisible = !highlightVisible;
    }, 1500);

    return () => clearInterval(interval);
  });

  function getRegionColor(region: Region): string {
    if (!gameState?.ownersByRegion) {
        return NEUTRAL_COLOR;
    }

    const ownerIndex = gameState.ownersByRegion[region.index];
    if (ownerIndex === undefined || ownerIndex === -1) {
        return NEUTRAL_COLOR;
    }

    const owner = gameState.players?.find(p => p.slotIndex === ownerIndex);
    return owner ? getPlayerMapColor(owner.slotIndex) : NEUTRAL_COLOR;
  }

  function getBorderColor(region: Region): string {
    if (selectedRegion && selectedRegion.index === region.index) {
      return '#facc15';
    }
    if (canHighlightForTurn(region)) {
      return '#facc15';
    }
    return '#4a5568';
  }

  function getBorderWidth(region: Region): number {
    if (selectedRegion && selectedRegion.index === region.index) {
      return 3;
    }
    if (canHighlightForTurn(region)) {
      return 2;
    }
    return 1;
  }

  function canHighlightForTurn(region: Region): boolean {
    if (!showTurnHighlights || effectivePreviewMode) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;

    const turnPlayer = currentTurnPlayer;
    if (!turnPlayer) return false;

    const isOwnedByCurrentPlayer = gameState.ownersByRegion?.[region.index] === turnPlayer.slotIndex;
    const soldierCount = gameState.soldiersByRegion?.[region.index]?.length || 0;
    const hasMovableSoldiers = soldierCount > 0;

    return isOwnedByCurrentPlayer && hasMovableSoldiers;
  }

  function handleRegionClick(region: Region): void {
    if (!effectivePreviewMode) {
      onRegionClick(region);
    }
  }
</script>

<div class="game-map" bind:this={mapContainerElement}>
  <svg class="map-svg" viewBox="0 0 800 600">
    <SvgDefinitions
      {gameState}
      {battlesInProgress}
    />

    {#each regions as region (region.index)}
      <RegionRenderer
        {region}
        {gameState}
        isSelected={selectedRegion?.index === region.index}
        isPreviewMode={effectivePreviewMode}
        canHighlight={canHighlightForTurn(region)}
        {highlightVisible}
        isBattleInProgress={battlesInProgress.has(region.index)}
        fillColor={getRegionColor(region)}
        borderColor={getBorderColor(region)}
        borderWidth={getBorderWidth(region)}
        onRegionClick={handleRegionClick}
      />
    {/each}
  </svg>
</div>

<style>
  .game-map {
    --map-ocean-color: #7fb2e3;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: var(--map-ocean-color);
    border-radius: 8px;
  }

  .map-svg {
    width: 100%;
    height: 100%;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>
