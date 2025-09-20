<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import Temple from './Temple.svelte';
  import Army from './Army.svelte';
  import { getPlayerMapColor, getPlayerHighlightColor } from '$lib/game/constants/playerConfigs';
  import { fade } from 'svelte/transition';
  import SvgDefinitions from './SvgDefinitions.svelte';
  import gameMapUtil from './gameMapUtil';

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
  let battleAnimations = new Map<number, string>();

  // Bind the internal element to the exported prop
  $: if (mapContainerElement && !mapContainer) {
    mapContainer = mapContainerElement;
  }

  $: currentTurnPlayer = (() => {
    if (!gameState?.players) return null;

    // Use playerIndex if available, otherwise fall back to currentPlayerIndex
    const playerIndex = gameState.playerIndex ?? gameState.currentPlayerIndex;
    return gameState.players.find(p => p.index === playerIndex) || null;
  })();

  // Auto-detect preview mode if currentPlayer is null but gameState exists
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode || previewMode;

  // Generate active player gradients
  $: activePlayerGradients = gameMapUtil.generateActivePlayerGradients(gameState, showTurnHighlights);


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

  function isOwnedByActivePlayer(regionIndex: number): boolean {
    if (!gameState?.ownersByRegion || !showTurnHighlights) return false;
    return gameState.ownersByRegion[regionIndex] === gameState.playerIndex;
  }

  function canHighlightForTurn(region: Region): boolean {
    if (!showTurnHighlights || effectivePreviewMode) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;

    const turnPlayer = currentTurnPlayer
    if (!turnPlayer) return false;
    const isOwnedByCurrentPlayer = gameState.ownersByRegion?.[region.index] === turnPlayer.index;

    const soldierCount = gameState.soldiersByRegion?.[region.index]?.length || 0;
    const hasMovedThisTurn = gameState.conqueredRegions?.includes(region.index) ?? false;

    return isOwnedByCurrentPlayer &&
           soldierCount > 1 &&
           !hasMovedThisTurn;
  }

  function getSoldierCount(regionIndex: number): number {
    if (!gameState?.soldiersByRegion?.[regionIndex]) return 0;
    return gameState.soldiersByRegion[regionIndex].length;
  }

  /**
   * Check if the region can be moved from
   */
  function canMoveFrom(region: Region): boolean {
    const turnPlayer = currentTurnPlayer;

    console.log('🏃 canMoveFrom debug for region', region.index, ':', {
      turnPlayer: turnPlayer ? { name: turnPlayer.name, slotIndex: turnPlayer.index } : null,
      regionOwner: gameState?.ownersByRegion?.[region.index],
      movesRemaining: gameState?.movesRemaining,
      soldierCount: gameState?.soldiersByRegion?.[region.index]?.length || 0,
    });

    if (effectivePreviewMode) return false;
    if (!currentPlayer || !gameState?.ownersByRegion || !gameState?.soldiersByRegion) return false;
    if (gameState.movesRemaining <= 0) return false;

    if (!turnPlayer) return false;
    const isOwnedByCurrentPlayer = gameState.ownersByRegion[region.index] === turnPlayer.index;
    const soldierCount = gameState.soldiersByRegion[region.index]?.length || 0;
    const hasMovedThisTurn = gameState.conqueredRegions?.includes(region.index) ?? false;

    const canMove = isOwnedByCurrentPlayer && soldierCount > 1 && !hasMovedThisTurn;

    console.log('🏃 canMoveFrom result:', canMove, {
      isOwnedByCurrentPlayer,
      soldierCount,
      hasMovedThisTurn
    });

    return canMove;
  }

  // Event handlers
  function handleRegionClick(region: Region): void {
    if (effectivePreviewMode) return;
    onRegionClick(region);
  }


  function handleKeyDown(event: KeyboardEvent, region: Region): void {
    if (effectivePreviewMode) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRegionClick(region);
    }
  }

  function getRegionColor(region: Region): string {
    if (!gameState?.ownersByRegion) return NEUTRAL_COLOR;

    const ownerIndex = gameState.ownersByRegion[region.index];

    // Check if this region is under attack
    if (battlesInProgress.has(region.index)) {
      // Show contested/battle state with animated pattern
      return `url(#battlePattern${region.index})`;
    }

    if (ownerIndex !== undefined) {
      const baseColor = getPlayerMapColor(ownerIndex);

      if (showTurnHighlights && isOwnedByActivePlayer(region.index) && highlightVisible) {
        return `url(#activePlayerGradient${ownerIndex})`;
      }

      return baseColor;
    }

    return NEUTRAL_COLOR;
  }

  function getBorderColor(region: Region): string {
    // Check if this is the selected region
    if (selectedRegion && selectedRegion.index === region.index) {
      return '#fbbf24'; // Bright yellow for selection
    }

    if (canHighlightForTurn(region) && highlightVisible) {
      return '#facc15';
    }

    // Default border for owned regions
    if (!gameState?.ownersByRegion) return '#333';

    const ownerIndex = gameState.ownersByRegion[region.index];
    if (ownerIndex !== undefined) {
      return getPlayerHighlightColor(ownerIndex);
    }

    return '#666';
  }

  function getBorderWidth(region: Region): number {
    // Selection gets thicker border
    if (selectedRegion && selectedRegion.index === region.index) {
      return 4;
    }

    if (canHighlightForTurn(region) && highlightVisible) {
      return 6;
    }

    return 1; // Default width
  }

  function getBattleClass(region: Region): string {
    const classes = [];

    if (battlesInProgress.has(region.index)) {
      classes.push('battle-in-progress');
    }

    if (canHighlightForTurn(region) && highlightVisible) {
      classes.push('highlight-active');
    }

    if (canMoveFrom(region)) {
      classes.push('can-move');
    }

    if (isHomeBase(region)) {
      classes.push('home-base');
    }

    return classes.join(' ');
  }

  /**
   * Get the filter value for battle states
   */
  function getBattleFilter(region: Region): string {
    if (battlesInProgress.has(region.index)) {
      return 'url(#battleGlow)';
    }

    if (canHighlightForTurn(region) && highlightVisible) {
      return 'url(#highlightGlow)';
    }

    return 'none';
  }

  /**
   * Get enhanced border effects for battle states
   */
  function getBorderEffects(region: Region): string {
    if (battlesInProgress.has(region.index)) {
      return 'filter="url(#battleGlow)"';
    }

    if (canHighlightForTurn(region) && highlightVisible) {
      return 'filter="url(#activeGlow)"';
    }

    return '';
  }

  /**
   * Check if a region is a home base (owned and has temple)
   */
  function isHomeBase(region: Region): boolean {
    if (!gameState?.ownersByRegion || !gameState?.templesByRegion) return false;

    const isOwned = gameState.ownersByRegion[region.index] !== undefined;
    const hasTemple = gameState.templesByRegion[region.index] !== undefined;

    return isOwned && hasTemple;
  }

  /**
   * Check if a region has a temple
   */
  function hasTemple(regionIndex: number): boolean {
    return gameState?.templesByRegion?.[regionIndex] !== undefined;
  }
</script>

<div class="game-map" bind:this={mapContainerElement}>
  <svg class="map-svg" viewBox="0 0 800 600">

    <SvgDefinitions
      {gameState}
      {battlesInProgress}
    />

    {#each regions as region (region.index)}
      {@const regionWithPoints = region}
      {@const regionPath = regionWithPoints.points ?
        gameMapUtil.pointsToPath(regionWithPoints.points) : gameMapUtil.createFallbackCircle(region)}

      <g class="region-group">
        <!-- Main region path -->
        <path
          d={regionPath}
          fill={getRegionColor(region)}
          stroke={getBorderColor(region)}
          stroke-width={getBorderWidth(region)}
          class="region-path {getBattleClass(region)}"
          filter={getBattleFilter(region)}
          role="button"
          tabindex={effectivePreviewMode ? -1 : 0}
          aria-label={`Region ${region.index}`}
          on:click={() => handleRegionClick(region)}
          on:keydown={(event) => handleKeyDown(event, region)}
        />

        <!-- Pulse overlay -->
        {#if canHighlightForTurn(region)}
          <path
            d={regionPath}
            fill="url(#pulsePattern)"
            stroke="#facc15"
            stroke-width="2"
            class="pulse-overlay"
            opacity={highlightVisible ? 0.9 : 0.2}
            transition:fade={{ duration: 750 }}
            style="pointer-events: none;"
          />
        {/if}

        <!-- Region content group (temples and armies) -->
        <g class="region-content">
          {#if hasTemple(region.index)}
            <Temple
              x={region.x}
              y={region.y}
              size="12"
              borderColor="#fbfbf4"
              level={gameState?.templesByRegion?.[region.index]?.level || 0}
              upgradeType={gameState?.templesByRegion?.[region.index]?.upgradeIndex}
            />
          {/if}

          {#if gameState?.soldiersByRegion?.[region.index]}
            {@const armies = gameState.soldiersByRegion[region.index].length}
            <Army
              x={region.x}
              y={region.y}
              armyCount={armies}
              hasTemple={hasTemple(region.index)}
            />
          {/if}
        </g>
      </g>
    {/each}
  </svg>
</div>

<style>
  .game-map {
    --map-ocean-color: #7fb2e3; /* Define ocean color once as CSS custom property */
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

  .region-path {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .region-path.preview-mode {
    cursor: default;
  }

  .region-path:hover:not(.preview-mode) {
    stroke-width: 2;
    filter: brightness(1.45);
  }

  /* Remove browser focus outline and use our dynamic border system */
  .region-path:focus:not(.preview-mode) {
    outline: none;
  }

  .region-path.can-move {
    cursor: pointer;
  }

  .region-path.can-move:hover {
    stroke: #10b981;
    stroke-width: 2;
  }

  .region-path.home-base {
    filter: brightness(1.3);
  }

  .pulse-overlay {
    pointer-events: none;
    transition: opacity 0.75s ease-in-out;
  }

  .battle-in-progress {
    animation: battle-pulse 1s ease-in-out infinite alternate;
  }

  @keyframes battle-pulse {
    from { stroke-width: 2; }
    to { stroke-width: 4; }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>