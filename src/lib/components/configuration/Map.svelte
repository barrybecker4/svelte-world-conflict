<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';
  import Temple from './Temple.svelte';
  import { getPlayerMapColor, getPlayerHighlightColor } from '$lib/game/constants/playerConfigs';

  export let regions: Region[] = [];
  export let gameState: WorldConflictGameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;
  export let isPreviewMode = false; // New prop to indicate preview mode

  const MAX_INDIVIDUAL_ARMIES = 16;
  const ARMIES_PER_ROW = 8;
  let mapContainer: HTMLDivElement;

  // Type for regions with border points
  interface RegionWithPoints extends Region {
    points?: Array<{x: number, y: number}>;
  }

  // Auto-detect preview mode if currentPlayer is null but gameState exists
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode;

  // Debug logging when regions change
  $: {
    if (regions.length > 0) {
      console.log('Map received regions:', regions.length);
      console.log('Preview mode:', effectivePreviewMode);
      if (gameState) {
        console.log('Game state players:', gameState.players?.length || 0);
        console.log('Owned regions:', Object.keys(gameState.owners || {}).length);
      }
    }
  }

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

  function getRegionOwner(regionIndex: number): Player | null {
    if (!gameState?.owners || gameState.owners[regionIndex] === undefined || gameState.owners[regionIndex] === -1) {
      return null;
    }
    const playerIndex = gameState.owners[regionIndex];
    return gameState.players?.[playerIndex] || null;
  }

  function getRegionColor(regionIndex: number): string {
    const owner = gameState?.owners?.[regionIndex];
    if (owner !== undefined && owner !== null) {
      return getPlayerMapColor(owner);
    }
    return '#6b7280'; // Gray for unowned
  }

  function getArmyCount(regionIndex: number): number {
    // The game state uses soldiersByRegion, not armies
    if (!gameState?.soldiersByRegion?.[regionIndex]) return 0;
    return gameState.soldiersByRegion[regionIndex].length;
  }

  function hasTemple(regionIndex: number): boolean {
    // Check both game state temples and region hasTemple property
    return gameState?.temples?.[regionIndex] !== undefined || regions[regionIndex]?.hasTemple === true;
  }

  function isNeutralRegion(regionIndex: number): boolean {
    return gameState?.owners?.[regionIndex] === undefined;
  }

  function getTempleUpgradeLevel(regionIndex: number): number {
    const temple = gameState?.temples?.[regionIndex];
    return temple?.level || 0;
  }

  function isSelected(region: Region): boolean {
    return selectedRegion?.index === region.index;
  }

  function isOwnedByCurrentPlayer(regionIndex: number): boolean {
    if (!currentPlayer || !gameState?.owners) return false;
    return gameState.owners[regionIndex] === currentPlayer.index;
  }

  function canMoveFrom(regionIndex: number): boolean {
    // In preview mode, no regions are moveable
    if (effectivePreviewMode) return false;
    return isOwnedByCurrentPlayer(regionIndex) && getArmyCount(regionIndex) > 0;
  }

  function isPlayerHomeBase(regionIndex: number): boolean {
    // A region is a home base if it's owned by a player and has a temple
    return getRegionOwner(regionIndex) !== null && hasTemple(regionIndex);
  }

  function handleRegionClick(region: Region): void {
    // Don't allow clicks in preview mode
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
</script>

<div class="game-map" bind:this={mapContainer}>
  <svg
    viewBox="0 0 800 600"
    class="map-svg"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- Background -->
    <rect
      width="800"
      height="600"
      fill="#1e3a8a"
    />

    <!-- Regions using pre-calculated border points -->
    {#each regions as region (region.index)}
      {@const regionWithPoints = region as RegionWithPoints}
      {@const isOccupied = getRegionOwner(region.index) !== null}
      {@const armies = getArmyCount(region.index)}
      {@const regionColor = getRegionColor(region.index)}
      {@const selected = isSelected(region)}
      {@const canMove = canMoveFrom(region.index)}
      {@const isHomeBase = isPlayerHomeBase(region.index)}
      {@const regionPath = regionWithPoints.points ? pointsToPath(regionWithPoints.points) : createFallbackCircle(region)}

      <!-- Region fill using pre-calculated border points -->
      <path
        d={regionPath}
        fill={regionColor}
        stroke="#1e293b"
        stroke-width="1"
        stroke-linejoin="round"
        class="region-path"
        class:selected
        class:can-move={canMove}
        class:home-base={isHomeBase}
        class:preview-mode={effectivePreviewMode}
        role="button"
        tabindex={effectivePreviewMode ? -1 : 0}
        aria-label="Region {region.index + 1} - {armies} armies"
        on:click={() => handleRegionClick(region)}
        on:keydown={(e) => handleKeyDown(e, region)}
      />

      <!-- Selection highlight -->
      {#if selected}
        <path
          d={regionPath}
          fill="none"
          stroke="#fbbf24"
          stroke-width="3"
          stroke-dasharray="8,4"
          stroke-linejoin="round"
          class="selection-highlight"
          pointer-events="none"
        />
      {/if}

      <!-- Home base highlight -->
      {#if isHomeBase && effectivePreviewMode}
        <path
          d={regionPath}
          fill="none"
          stroke="#10b981"
          stroke-width="2"
          stroke-dasharray="6,3"
          stroke-linejoin="round"
          class="home-base-highlight"
          pointer-events="none"
        />
      {/if}
    {/each}

    <!-- Region content (centers, armies, etc.) -->
    {#each regions as region (region.index)}
      {@const isOccupied = getRegionOwner(region.index) !== null}
      {@const armies = getArmyCount(region.index)}
      {@const temple = gameState?.temples?.[region.index]}

      <g class="region-content">
        <!-- Temple rendering (if region has temple) -->
        {#if hasTemple(region.index)}
          <Temple
            x={region.x}
            y={region.y - 6}
            upgradeLevel={temple?.level || 0}
            isPlayerOwned={isOccupied}
            regionIndex={region.index}
          />
        {/if}

        <!-- Army count display (below temple if present, otherwise at center) -->
        {#if armies > 0}
          {#if armies <= MAX_INDIVIDUAL_ARMIES}
            <!-- Individual army dots for small armies -->
            {#each Array(armies) as _, i}
              <circle
                cx={region.x - 10 + (i % ARMIES_PER_ROW) * 4}
                cy={region.y + 10 + Math.floor(i / ARMIES_PER_ROW) * 4}
                r="1.5"
                fill="white"
                stroke="#374151"
                stroke-width="0.5"
              />
            {/each}
          {:else}
            <!-- Army count text for larger armies -->
            <circle
              cx={region.x}
              cy={region.y + (hasTemple(region.index) ? 15 : 0)}
              r="10"
              fill="rgba(0,0,0,0.7)"
              stroke="#fbfbf4"
              stroke-width="1"
            />
            <text
              x={region.x}
              y={region.y + (hasTemple(region.index) ? 18 : 3)}
              text-anchor="middle"
              font-size="10"
              font-weight="bold"
              fill="#fbfbf4"
            >
              {armies}
            </text>
          {/if}
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .game-map {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: #1e3a8a;
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
    filter: brightness(1.15);
  }

  .region-path:focus:not(.preview-mode) {
    outline: none;
    stroke: #fbbf24;
    stroke-width: 3;
  }

  .region-path.selected {
    stroke: #fbbf24;
    stroke-width: 3;
  }

  .region-path.can-move {
    cursor: pointer;
  }

  .region-path.can-move:hover {
    stroke: #10b981;
    stroke-width: 2;
  }

  .region-path.home-base {
    filter: brightness(1.1);
  }

  .selection-highlight {
    pointer-events: none;
    animation: dash 2s linear infinite;
  }

  .home-base-highlight {
    pointer-events: none;
    animation: dash 3s linear infinite;
  }

  .region-content {
    pointer-events: none;
  }

  /* Army count styling */
  .region-content text {
    font-family: 'Arial', sans-serif;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  }

  .region-content circle {
    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
  }

  @keyframes dash {
    to {
      stroke-dashoffset: -24;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>
