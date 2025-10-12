<script lang="ts">
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import { getPlayerMapColor, getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import SvgDefinitions from './SvgDefinitions.svelte';
  import RegionRenderer from './RegionRenderer.svelte';

  export let regions: Region[] = [];
  export let gameState: GameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let onTempleClick: (regionIndex: number) => void = () => {};
  export let selectedRegion: Region | null = null;
  export let validTargetRegions: number[] = [];
  export let isPreviewMode = false;
  export let showTurnHighlights: boolean = true;
  export let previewMode: boolean = false;
  export let mapContainer: HTMLElement | undefined = undefined;

  const NEUTRAL_COLOR = '#c2b5a3';

  let mapContainerElement: HTMLDivElement;
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
    return '#4a5568';
  }

  function getBorderWidth(region: Region): number {
    if (selectedRegion && selectedRegion.index === region.index) {
      return 3;
    }
    return 1;
  }
  
  function getInnerBorderColor(region: Region, isSelected: boolean = false): string {
    if (!gameState?.ownersByRegion) {
        return '';
    }

    const ownerIndex = gameState.ownersByRegion[region.index];
    if (ownerIndex === undefined || ownerIndex === -1) {
        return '';
    }

    const config = getPlayerConfig(ownerIndex);
    // Use highlight colors - start for less intense, end for selected
    return isSelected ? config.highlightEnd : config.highlightStart;
  }

  function canHighlightForTurn(region: Region): boolean {
    if (!showTurnHighlights || effectivePreviewMode) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;
    if (!currentPlayer) return false;

    // Only highlight if it's the current player's turn (not just any player's turn)
    if (currentPlayer.slotIndex !== gameState.currentPlayerSlot) return false;

    const isOwnedByCurrentPlayer = gameState.ownersByRegion?.[region.index] === currentPlayer.slotIndex;
    const soldierCount = gameState.soldiersByRegion?.[region.index]?.length || 0;
    const hasMovableSoldiers = soldierCount > 0;
    
    // Don't highlight regions that were just conquered this turn
    const wasConqueredThisTurn = gameState.conqueredRegions?.includes(region.index) || false;

    return isOwnedByCurrentPlayer && hasMovableSoldiers && !wasConqueredThisTurn;
  }

  function handleRegionClick(region: Region): void {
    if (effectivePreviewMode) return;
    
    // Don't allow clicks if no moves remaining
    if (!gameState || gameState.movesRemaining <= 0) {
      return;
    }
    
    // Don't allow clicks if not current player's turn
    if (!currentPlayer || currentPlayer.slotIndex !== gameState.currentPlayerSlot) {
      return;
    }
    
    onRegionClick(region);
  }

  function handleTempleClick(regionIndex: number): void {
    if (effectivePreviewMode) return;
    
    // Don't allow temple clicks if no moves remaining
    if (!gameState || gameState.movesRemaining <= 0) {
      return;
    }
    
    // Don't allow clicks if not current player's turn
    if (!currentPlayer || currentPlayer.slotIndex !== gameState.currentPlayerSlot) {
      return;
    }
    
    onTempleClick(regionIndex);
  }
</script>

<div class="game-map" bind:this={mapContainerElement}>
  <svg class="map-svg" viewBox="0 0 800 600">
    <SvgDefinitions
      {gameState}
      {battlesInProgress}
    />

    <g filter="url(#regionShadow)">
    {#each regions as region (region.index)}
      {@const isSelected = selectedRegion ? selectedRegion.index === region.index : false}
      {@const isValidTarget = validTargetRegions.includes(region.index)}
      {@const isMovable = canHighlightForTurn(region)}
      {@const hasMovesRemaining = !!(gameState && gameState.movesRemaining > 0)}
      {@const isMyTurn = !!(currentPlayer && gameState && currentPlayer.slotIndex === gameState.currentPlayerSlot)}
      {@const isClickable = !!(hasMovesRemaining && isMyTurn)}
      <RegionRenderer
        {region}
        {gameState}
        isValidTarget={isValidTarget}
        isSelected={isSelected}
        isPreviewMode={effectivePreviewMode}
        canHighlight={isMovable}
        isBattleInProgress={battlesInProgress.has(region.index)}
        fillColor={getRegionColor(region)}
        borderColor={getBorderColor(region)}
        borderWidth={getBorderWidth(region)}
        innerBorderColor={isSelected || isMovable || isValidTarget ? getInnerBorderColor(region, isSelected) : ''}
        innerBorderWidth={isSelected ? 10 : 8}
        isClickable={isClickable}
        onRegionClick={handleRegionClick}
        onTempleClick={handleTempleClick}
      />
    {/each}
    </g>
  </svg>
</div>

<style>
  .game-map {
    --map-ocean-color: #5b9fd8;
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
