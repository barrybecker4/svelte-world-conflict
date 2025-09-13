<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import Temple from './Temple.svelte';
  import Army from './Army.svelte';  // Add this import
  import { getPlayerMapColor, getPlayerHighlightColor } from '$lib/game/constants/playerConfigs';
  import { fade } from 'svelte/transition';

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

  onMount(() => {
    // Start the highlight pulse animation
    const interval = setInterval(() => {
      highlightVisible = !highlightVisible;
    }, 1500);

    return () => clearInterval(interval);
  });

  $: {
    if (gameState?.battlesInProgress) {
      battlesInProgress = new Set(gameState.battlesInProgress);
    }
  }

  // Auto-detect preview mode if currentPlayer is null but gameState exists
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode || previewMode;

  // Additional check for preview mode based on gameState
  $: isCreationMode = gameState?.gameId === 'preview' || currentPlayer === null;

  // Debug logging when regions change
  $: {
    if (regions.length > 0) {
      console.log('Map received regions:', regions.length);
      console.log('Current player:', currentPlayer);
      console.log('Selected region:', selectedRegion);
      if (gameState) {
        console.log('Game state ID:', gameState.gameId);
        console.log('Game state players:', gameState.players?.length || 0);
        console.log('Owned regions:', Object.keys(gameState.ownersByRegion || {}).length);
      }
    }
  }

  $: activePlayerGradients = gameState && showTurnHighlights ? Array.from({length: 6}, (_, i) => {
    const color = getPlayerMapColor(i);
    return `
      <radialGradient id="activePlayerGradient${i}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:0.9"/>
        <stop offset="70%" style="stop-color:${color};stop-opacity:0.7"/>
        <stop offset="100%" style="stop-color:${color};stop-opacity:0.6"/>
      </radialGradient>
    `;
  }).join('') : '';

  /**
   * Convert border points to SVG path
   */
  function pointsToPath(points: Array<{x: number, y: number}>): string {
    if (!points || points.length < 3) return '';

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${points[i].y}`;
    }
    path += ' Z';

    return path;
  }

  /**
   * Create fallback circle for regions without border points
   */
  function createFallbackCircle(region: Region): string {
    const radius = 35;
    return `M ${region.x + radius},${region.y} A ${radius},${radius} 0 1,1 ${region.x + radius - 0.1},${region.y} Z`;
  }

  function isOwnedByActivePlayer(regionIndex: number): boolean {
    if (!gameState?.ownersByRegion || !showTurnHighlights) return false;
    return gameState.ownersByRegion[regionIndex] === gameState.playerIndex;
  }

  function getSoldierCount(regionIndex: number): number {
    if (!gameState?.soldiersByRegion?.[regionIndex]) return 0;
    return gameState.soldiersByRegion[regionIndex].length;
  }

  function canHighlightForTurn(region: Region): boolean {
    if (!showTurnHighlights || effectivePreviewMode) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;

    // gameState.playerIndex is now slot index of current turn player
    const isOwnedByCurrentPlayer = gameState.ownersByRegion?.[region.index] === gameState.playerIndex;
    const soldierCount = gameState.soldiersByRegion?.[region.index]?.length || 0;
    const hasMovedThisTurn = gameState.conqueredRegions?.includes(region.index) ?? false;

    return isOwnedByCurrentPlayer &&
           soldierCount > 1 &&
           !hasMovedThisTurn;
  }

  /**
   * Create a lighter version of a hex color for selection borders
   */
  function getLighterColor(hexColor: string, factor: number = 0.3): string {
    // Remove the hash if present
    const color = hexColor.replace('#', '');

    // Parse r, g, b values
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);

    // Lighten by moving towards white
    const newR = Math.round(r + (255 - r) * factor);
    const newG = Math.round(g + (255 - g) * factor);
    const newB = Math.round(b + (255 - b) * factor);

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get the color for a region based on ownership
   */
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

  /**
   * Get the border color for a region
   */
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

  /**
   * Get the border width for a region
   */
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

  /**
   * Get CSS class for battle states
   */
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

  function debugHighlighting(region: Region): void {
    console.log(`Region ${region.index} highlight check:`, {
      showTurnHighlights,
      effectivePreviewMode,
      movesRemaining: gameState?.movesRemaining,
      isOwnedByCurrentPlayer: gameState?.ownersByRegion?.[region.index] === gameState?.playerIndex,
      soldierCount: gameState?.soldiersByRegion?.[region.index]?.length || 0,
      hasMovedThisTurn: gameState?.conqueredRegions?.includes(region.index),
      canHighlight: canHighlightForTurn(region),
      highlightVisible
    });
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

  /**
   * Check if the region can be moved from
   */
  function canMoveFrom(region: Region): boolean {
    if (effectivePreviewMode) return false;
    if (!currentPlayer || !gameState?.ownersByRegion || !gameState?.soldiersByRegion) return false;
    if (gameState.movesRemaining <= 0) return false;

    const activePlayer = gameState.players[gameState.playerIndex];
    const isOwnedByCurrentPlayer = gameState.ownersByRegion[region.index] === activePlayer?.index;
    const soldierCount = gameState.soldiersByRegion[region.index]?.length || 0;
    const hasMovedThisTurn = gameState.conqueredRegions?.includes(region.index) ?? false;

    return isOwnedByCurrentPlayer && soldierCount > 1 && !hasMovedThisTurn;
  }

  /**
   * Handle region clicks
   */
  function handleRegionClick(region: Region): void {
    if (effectivePreviewMode) return;
    onRegionClick(region);
  }

  /**
   * Handle keyboard events for accessibility
   */
  function handleKeyDown(event: KeyboardEvent, region: Region): void {
    if (effectivePreviewMode) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRegionClick(region);
    }
  }
</script>

<div class="game-map" bind:this={mapContainerElement}>
  <svg class="map-svg" viewBox="0 0 800 600">
    <defs>
      {@html activePlayerGradients}

      <!-- Glow effect for active regions -->
      <filter id="activeGlow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <filter id="highlightGlow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feColorMatrix type="matrix" values="1.2 1.2 0 0 0  1.2 1.2 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Pulse pattern for active regions -->
      <pattern id="pulsePattern" patternUnits="userSpaceOnUse" width="20" height="20">
        <rect width="20" height="20" fill="rgba(250, 204, 21, 0.3)"/>
        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(250, 204, 21, 0.6)" stroke-width="2"/>
      </pattern>

      <!-- Battle progress patterns -->
      {#each Array.from(battlesInProgress) as regionIndex}
        <pattern id="battlePattern{regionIndex}" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="{getPlayerMapColor(gameState?.ownersByRegion?.[regionIndex] || 0)}" opacity="0.7"/>
          <rect width="40" height="40" fill="none" stroke="#ff6b35" stroke-width="3" stroke-dasharray="10,5">
            <animate attributeName="stroke-dashoffset" values="0;15" dur="1s" repeatCount="indefinite"/>
          </rect>
          <circle cx="20" cy="20" r="8" fill="#ff6b35" opacity="0.6">
            <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite"/>
          </circle>
        </pattern>
      {/each}

      <!-- Battle glow effect -->
      <filter id="battleGlow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
        <feColorMatrix type="matrix" values="1 0.3 0 0 0  0.3 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    {#each regions as region (region.index)}
      {@const regionWithPoints = region}
      {@const regionPath = regionWithPoints.points ?
        pointsToPath(regionWithPoints.points) : createFallbackCircle(region)}

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

        <!-- ADD PULSE OVERLAY FOR ACTIVE PLAYER REGIONS -->
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

  /* Remove the static .selected styling since we use dynamic stroke colors */
  .region-path.selected {
    /* Border is now handled dynamically in the SVG stroke attribute */
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
