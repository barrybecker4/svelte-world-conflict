<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/gameTypes';
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

  // Auto-detect preview mode if currentPlayer is null but gameState exists
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode;

  // Additional check for preview mode based on gameState
  $: isCreationMode = gameState?.gameId === 'preview' || currentPlayer === null;

  // Debug logging when regions change
  $: {
    if (regions.length > 0) {
      console.log('Map received regions:', regions.length);
      console.log('Preview mode:', effectivePreviewMode);
      console.log('Creation mode:', isCreationMode);
      console.log('Current player:', currentPlayer);
      console.log('Selected region:', selectedRegion);
      if (gameState) {
        console.log('Game state ID:', gameState.gameId);
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

  /**
   * Create a lighter version of a hex color for selection borders
   */
  function getLighterColor(hexColor: string): string {
    // Remove # if present
    const color = hexColor.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);

    // Make it lighter by adding to each component (but not too much to avoid white)
    const lighterR = Math.min(255, Math.floor(r + (255 - r) * 0.4));
    const lighterG = Math.min(255, Math.floor(g + (255 - g) * 0.4));
    const lighterB = Math.min(255, Math.floor(b + (255 - b) * 0.4));

    // Convert back to hex
    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get the selection border color for a region
   */
  function getSelectionBorderColor(regionIndex: number): string {
    const regionColor = getRegionColor(regionIndex);
    return getLighterColor(regionColor);
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

  function getSoldierCount(regionIndex: number): number {
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
    return isOwnedByCurrentPlayer(regionIndex) && getSoldierCount(regionIndex) > 0;
  }

  function isPlayerHomeBase(regionIndex: number): boolean {
    // A region is a home base if it's owned by a player and has a temple
    return getRegionOwner(regionIndex) !== null && hasTemple(regionIndex);
  }

  /**
   * Check if a player can move to a specific region from any of their owned regions
   * This determines visual feedback in the UI (like highlighting clickable regions)
   */
  function canPlayerMoveToRegion(player: Player, region: Region): boolean {
    // In preview mode, no moves are allowed
    if (effectivePreviewMode) return false;

    // Player must exist
    if (!player || !gameState) return false;

    // Check if this region is owned by the current player and has armies to move
    const isOwnedByPlayer = gameState.owners?.[region.index] === player.index;
    const hasArmies = getSoldierCount(region.index) > 1; // Need more than 1 to move (leave 1 defender)

    if (isOwnedByPlayer && hasArmies) {
      // Check if this region hasn't already moved this turn
      const hasMovedThisTurn = gameState.conqueredRegions?.includes(region.index) ?? false;
      return !hasMovedThisTurn;
    }

    // If not owned by player, check if it's adjacent to any region the player can move from
    if (!isOwnedByPlayer) {
      // Find all regions owned by the player that can move
      const playerOwnedRegions = regions.filter(r => {
        const regionOwnedByPlayer = gameState.owners?.[r.index] === player.index;
        const regionHasArmies = getSoldierCount(r.index) > 1;
        const regionHasNotMoved = !(gameState.conqueredRegions?.includes(r.index) ?? false);

        return regionOwnedByPlayer && regionHasArmies && regionHasNotMoved;
      });

      // Check if any of these regions are neighbors to the target region
      return playerOwnedRegions.some(ownedRegion =>
        ownedRegion.neighbors.includes(region.index)
      );
    }

    return false;
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
  <svg class="map-svg" viewBox="0 0 800 600">
    <!-- Create a definition for our shadow filter that only affects ocean areas -->
    <defs>
      <!-- Create a mask for the ocean (everything not covered by regions) -->
      <mask id="oceanMask">
        <!-- Start with white background (ocean areas) -->
        <rect width="100%" height="100%" fill="white"/>
        <!-- Subtract all regions (black areas where regions exist) -->
        {#each regions as region (region.index)}
          {@const regionWithPoints = region}
          {@const regionPath = regionWithPoints.points ?
            pointsToPath(regionWithPoints.points) : createFallbackCircle(region)}
          <path
            d={regionPath}
            fill="black"
          />
        {/each}
      </mask>

      <!-- Shadow filter that only applies to ocean areas -->
      <filter id="oceanShadow">
        <feDropShadow dx="5" dy="5" stdDeviation="1" flood-color="rgba(0,0,0,0.7)"/>
      </filter>
    </defs>

    <!-- First pass: render all regions without shadows -->
    {#each regions as region (region.index)}
      {@const regionWithPoints = region}
      {@const regionPath = regionWithPoints.points ?
        pointsToPath(regionWithPoints.points) : createFallbackCircle(region)}
      {@const regionColor = getRegionColor(region.index)}
      {@const selected = selectedRegion?.index === region.index}
      {@const canMove = currentPlayer && canPlayerMoveToRegion(currentPlayer, region)}
      {@const isHomeBase = currentPlayer && region.index === currentPlayer.homeRegion}
      {@const armies = getSoldierCount(region.index)}

      <!-- Region fill with dynamic border colors -->
      <path
        d={regionPath}
        fill={regionColor}
        stroke={selected ? getSelectionBorderColor(region.index) : "#1e293b"}
        stroke-width={selected ? "4" : "1"}
        stroke-linejoin="round"
        class="region-path"
        class:selected
        class:can-move={canMove}
        class:home-base={isHomeBase}
        class:preview-mode={effectivePreviewMode}
        role="button"
        aria-label="Region {region.index + 1} - {armies} armies"
        on:click={() => handleRegionClick(region)}
        on:keydown={(e) => handleKeyDown(e, region)}
      />
    {/each}

    <!-- Second pass: render shadow layer that only affects ocean areas -->
    {#each regions as region (region.index)}
      {@const regionWithPoints = region}
      {@const regionPath = regionWithPoints.points ?
        pointsToPath(regionWithPoints.points) : createFallbackCircle(region)}
      {@const regionColor = getRegionColor(region.index)}

      <!-- Shadow version of region that only shows over ocean -->
      <path
        d={regionPath}
        fill={regionColor}
        stroke="none"
        mask="url(#oceanMask)"
        filter="url(#oceanShadow)"
        pointer-events="none"
        opacity="0.8"
      />
    {/each}

    <!-- Region content (centers, armies, etc.) -->
    {#each regions as region (region.index)}
      {@const isOccupied = getRegionOwner(region.index) !== null}
      {@const armies = getSoldierCount(region.index)}
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

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>
