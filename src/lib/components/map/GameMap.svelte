<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import { getPlayerMapColor, getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { TooltipData } from '$lib/client/feedback/TutorialTips';
  import { smokeStore } from '$lib/client/stores/smokeStore';
  import SvgDefinitions from './SvgDefinitions.svelte';
  import RegionRenderer from './RegionRenderer.svelte';
  import Army from './Army.svelte';
  import Tooltip from '../ui/Tooltip.svelte';

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
  export let tutorialTips: TooltipData[] = [];
  export let onDismissTooltip: (tooltipId: string) => void = () => {};

  // Debug tooltips
  $: if (tutorialTips.length > 0) {
    console.log('🗺️ GameMap received tooltips:', tutorialTips);
  }

  const NEUTRAL_COLOR = '#c2b5a3';

  let mapContainerElement: HTMLDivElement;
  let battlesInProgress = new Set<number>();
  let animationTick = 0;

  // Animation ticker for smoke particles
  let animationFrame: number | null = null;
  let isAnimating = false;

  function startAnimationLoop() {
    if (isAnimating) return; // Already running

    isAnimating = true;
    function tick() {
      animationTick = Date.now();
      if ($smokeStore.length > 0) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        // No more particles, stop the loop
        isAnimating = false;
        animationFrame = null;
      }
    }
    tick();
  }

  // Start/stop animation loop based on smoke particles
  $: if ($smokeStore.length > 0 && !isAnimating) {
    startAnimationLoop();
  }

  onDestroy(() => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
      isAnimating = false;
    }
  });

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

  function getInnerBorderColor(region: Region, isSelected: boolean = false, isValidTarget: boolean = false): string {
    if (!gameState?.ownersByRegion) {
        return '';
    }

    const ownerIndex = gameState.ownersByRegion[region.index];

    // For neutral regions that are valid targets, use the current player's color
    if ((ownerIndex === undefined || ownerIndex === -1) && isValidTarget && currentPlayer) {
        const config = getPlayerConfig(currentPlayer.slotIndex);
        return isSelected ? config.highlightEnd : config.highlightStart;
    }

    // For neutral regions that aren't valid targets, no highlight
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

    <!-- Regions layer (bottom) -->
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
        {regions}
        isValidTarget={isValidTarget}
        isSelected={isSelected}
        isPreviewMode={effectivePreviewMode}
        canHighlight={isMovable}
        isBattleInProgress={battlesInProgress.has(region.index)}
        fillColor={getRegionColor(region)}
        borderColor={getBorderColor(region)}
        borderWidth={getBorderWidth(region)}
        innerBorderColor={isSelected || isMovable || isValidTarget ? getInnerBorderColor(region, isSelected, isValidTarget) : ''}
        innerBorderWidth={isSelected ? 10 : 8}
        isClickable={isClickable}
        onRegionClick={handleRegionClick}
        onTempleClick={handleTempleClick}
        renderArmies={false}
      />
    {/each}
    </g>

    <!-- Armies layer (top) - rendered above all regions -->
    <g class="armies-layer">
    {#each regions as region (region.index)}
      {@const soldierCount = gameState?.soldiersByRegion?.[region.index]?.length || 0}
      {@const hasTemple = gameState?.templesByRegion?.[region.index] !== undefined}
      {#if soldierCount > 0}
        <Army
          x={region.x}
          y={region.y}
          {hasTemple}
          {gameState}
          {regions}
          {region}
        />
      {/if}
    {/each}
    </g>

    <!-- Smoke layer (top-most) - rendered above everything -->
    <g class="smoke-layer">
    {#each $smokeStore as particle (particle.id)}
      {@const age = animationTick - particle.timestamp}
      {@const progress = Math.min(age / 3050, 1)}
      {@const opacity = Math.max(0, 0.4 * (1.0 - progress))}
      {@const currentY = particle.y - (progress * 25)}
      {@const currentR = 2 + (progress * 6)}

      <!-- Outer glow (blurred) -->
      <circle
        class="smoke-particle-glow"
        cx={particle.x}
        cy={currentY}
        r={currentR * 1.5}
        fill="#222"
        fill-opacity={opacity * 0.25}
      />

      <!-- Main particle -->
      <circle
        class="smoke-particle"
        cx={particle.x}
        cy={currentY}
        r={currentR}
        fill="#111"
        fill-opacity={opacity * 0.35}
      />
    {/each}
    </g>
  </svg>

  <!-- Tutorial Tooltips -->
  {#if tutorialTips.length > 0}
    <div style="position: absolute; top: 10px; left: 10px; background: orange; color: black; padding: 4px; z-index: 1000; font-size: 10px;">
      DEBUG: {tutorialTips.length} tooltip(s)
    </div>
  {/if}
  {#each tutorialTips as tooltip (tooltip.id)}
    <Tooltip
      id={tooltip.id}
      x={tooltip.x}
      y={tooltip.y}
      text={tooltip.text}
      width={tooltip.width || 7}
      onDismiss={onDismissTooltip}
    />
  {/each}
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

  /* Smoke particle styling - matches old GAS version with box-shadow glow effect */
  :global(.smoke-particle),
  :global(.smoke-particle-glow) {
    pointer-events: none;
  }

  :global(.smoke-particle-glow) {
    filter: blur(2px);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>
