<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';
  import Temple from './Temple.svelte';

  export let regions: Region[] = [];
  export let gameState: WorldConflictGameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;

  const MAX_INDIVIDUAL_ARMIES = 16;
  const ARMIES_PER_ROW = 8;
  let mapContainer: HTMLDivElement;
  let mapWidth = 800;
  let mapHeight = 600;

  // Type for regions with border points
  interface RegionWithPoints extends Region {
    points?: Array<{x: number, y: number}>;
  }

  // Debug logging when regions change
  $: {
    if (regions.length > 0) {
      console.log('GameMap received regions:', regions.length);
      console.log('First region:', regions[0]);
      console.log('First region points:', (regions[0] as RegionWithPoints).points?.length || 0);
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
    const owner = getRegionOwner(regionIndex);
    if (!owner) return '#6b7280'; // Neutral gray

    const playerColors = [
      '#dc2626', // Red
      '#2563eb', // Blue
      '#8A2BE2', // Purple
      '#059669'  // Green
    ];

    return playerColors[owner.index] || '#6b7280';
  }

  function getArmyCount(regionIndex: number): number {
    // The game state uses soldiersByRegion, not armies
    if (!gameState?.soldiersByRegion?.[regionIndex]) return 0;
    return gameState.soldiersByRegion[regionIndex].length;
  }

  function hasTemple(regionIndex: number): boolean {
    return gameState?.temples?.[regionIndex] !== undefined;
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
    return isOwnedByCurrentPlayer(regionIndex) && getArmyCount(regionIndex) > 0;
  }

  function handleRegionClick(region: Region): void {
    onRegionClick(region);
  }

  function handleKeyDown(event: KeyboardEvent, region: Region): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRegionClick(region);
    }
  }
</script>

<div class="game-map" bind:this={mapContainer}>
  <svg
    width={mapWidth}
    height={mapHeight}
    viewBox="0 0 {mapWidth} {mapHeight}"
    class="map-svg"
  >
    <!-- Background -->
    <rect
      width={mapWidth}
      height={mapHeight}
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
        role="button"
        tabindex="0"
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

    <!-- Debug info -->
    {#if regions.length > 0}
      {@const regionsWithPoints = regions.filter(r => (r as RegionWithPoints).points?.length > 0)}
      <text x="10" y="25" fill="#94a3b8" font-size="12" font-family="monospace">
        Regions: {regions.length} | With border points: {regionsWithPoints.length}
      </text>
      {#if regionsWithPoints.length > 0}
        <text x="10" y="45" fill="#94a3b8" font-size="10" font-family="monospace">
          First region has {(regions[0] as RegionWithPoints).points?.length || 0} points
        </text>
      {/if}
    {/if}
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

  .region-path:hover {
    stroke-width: 2;
    filter: brightness(1.15);
  }

  .region-path:focus {
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

  .selection-highlight {
    pointer-events: none;
    animation: dash 2s linear infinite;
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
