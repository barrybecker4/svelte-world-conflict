<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';

  export let regions: Region[] = [];
  export let gameState: WorldConflictGameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;

  let mapContainer: HTMLDivElement;
  let mapWidth = 800;
  let mapHeight = 600;

  // Enhanced region interface with boundary data
  interface EnhancedRegion extends Region {
    boundary?: string;
  }

  // Enhanced regions with boundary data
  let enhancedRegions: EnhancedRegion[] = [];

  // Generate more natural, organic region boundaries with lakes consideration
  function generateOrganicVoronoi(
    regions: Region[],
    mapWidth: number,
    mapHeight: number
  ): Array<{region: Region, boundary: string}> {
    const organicRegions: Array<{region: Region, boundary: string}> = [];

    // For each region, create a more natural boundary
    for (const region of regions) {
      const cellBoundary = computeOrganicCell(region, regions, mapWidth, mapHeight);
      organicRegions.push({
        region,
        boundary: cellBoundary
      });
    }

    return organicRegions;
  }

  function computeOrganicCell(
    region: Region,
    allRegions: Region[],
    mapWidth: number,
    mapHeight: number
  ): string {
    // Find average distance to neighbors for sizing
    const neighborDistances = region.neighbors
      .map(nIndex => {
        const neighbor = allRegions.find(r => r.index === nIndex);
        return neighbor ? Math.sqrt(
          Math.pow(neighbor.x - region.x, 2) + Math.pow(neighbor.y - region.y, 2)
        ) : 100;
      });

    const avgDistance = neighborDistances.length > 0
      ? neighborDistances.reduce((a, b) => a + b, 0) / neighborDistances.length
      : 80;

    // Create more organic, irregular boundaries
    const cellPoints: Array<{x: number, y: number}> = [];
    const numSamples = 24; // Fewer samples for more angular, organic shapes
    const baseRadius = Math.min(avgDistance * 0.4, 65); // Slightly larger for better coverage

    for (let i = 0; i < numSamples; i++) {
      const angle = (i / numSamples) * Math.PI * 2;

      // Create more natural distance variation
      let distanceToEdge = baseRadius;

      // Check for neighboring regions and adjust boundary
      for (const otherRegion of allRegions) {
        if (otherRegion.index === region.index) continue;

        const dx = otherRegion.x - region.x;
        const dy = otherRegion.y - region.y;
        const distanceToOther = Math.sqrt(dx * dx + dy * dy);

        if (distanceToOther > 0 && distanceToOther < baseRadius * 3) {
          const angleToOther = Math.atan2(dy, dx);
          let angleDiff = Math.abs(angle - angleToOther);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          // If pointing toward another region, create shared boundary
          if (angleDiff < Math.PI / 2) { // Within 90 degrees
            const influence = 1 - (angleDiff / (Math.PI / 2));
            const sharedDistance = distanceToOther * (0.5 + influence * 0.1);
            distanceToEdge = Math.min(distanceToEdge, sharedDistance);
          }
        }
      }

      distanceToEdge = Math.max(baseRadius * 0.2, Math.min(baseRadius * 1.4, distanceToEdge));

      const x = Math.max(5, Math.min(mapWidth - 5, region.x + Math.cos(angle) * distanceToEdge));
      const y = Math.max(5, Math.min(mapHeight - 5, region.y + Math.sin(angle) * distanceToEdge));

      cellPoints.push({ x, y });
    }

    if (cellPoints.length < 3) {
      // Fallback
      return `M ${region.x + 30},${region.y} A 30,30 0 1,1 ${region.x + 29},${region.y} Z`;
    }

    // Create more irregular, organic boundary
    return createIrregularOrganicPath(cellPoints);
  }

  function createIrregularOrganicPath(points: Array<{x: number, y: number}>): string {
    if (points.length < 3) return '';

    // Create more irregular path with varying curve types
    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const prev = points[i - 1];
      const next = points[(i + 1) % points.length];

      // Randomly choose between different curve types for variety
      const curveType = Math.random();

      if (curveType < 0.3) {
        // Straight line (creates angular features)
        path += ` L ${current.x},${current.y}`;
      } else if (curveType < 0.7) {
        // Quadratic curve (smooth curves)
        const cpx = current.x + (Math.random() - 0.5) * 15;
        const cpy = current.y + (Math.random() - 0.5) * 15;
        path += ` Q ${cpx},${cpy} ${current.x},${current.y}`;
      } else {
        // Cubic curve (complex curves)
        const cp1x = prev.x + (current.x - prev.x) * 0.3 + (Math.random() - 0.5) * 10;
        const cp1y = prev.y + (current.y - prev.y) * 0.3 + (Math.random() - 0.5) * 10;
        const cp2x = current.x + (next.x - current.x) * 0.3 + (Math.random() - 0.5) * 10;
        const cp2y = current.y + (next.y - current.y) * 0.3 + (Math.random() - 0.5) * 10;
        path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${current.x},${current.y}`;
      }
    }

    // Close with organic curve back to start
    const first = points[0];
    const last = points[points.length - 1];
    const cpx = last.x + (first.x - last.x) * 0.5 + (Math.random() - 0.5) * 8;
    const cpy = last.y + (first.y - last.y) * 0.5 + (Math.random() - 0.5) * 8;
    path += ` Q ${cpx},${cpy} ${first.x},${first.y} Z`;

    return path;
  }

  // Update enhanced regions when regions change - use organic Voronoi
  $: {
    if (regions.length > 0) {
      const organicCells = generateOrganicVoronoi(regions, mapWidth, mapHeight);
      enhancedRegions = organicCells.map(cell => ({
        ...cell.region,
        boundary: cell.boundary
      }));
    }
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
    if (!owner) return '#6b7280'; // neutral gray for unoccupied regions

    const playerColors = ['#dc2626', '#2563eb', '#8A2BE2', '#059669'];
    return playerColors[owner.index % playerColors.length];
  }

  function getRegionArmies(regionIndex: number): number {
    // Handle both array format and object format
    const soldiers = gameState?.soldiersByRegion?.[regionIndex];
    if (Array.isArray(soldiers)) {
      return soldiers.length || 0;
    }
    return 0;
  }

  function handleRegionClick(region: Region) {
    onRegionClick(region);
  }

  function handleRegionKeydown(event: KeyboardEvent, region: Region) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRegionClick(region);
    }
  }

  function isRegionSelected(regionIndex: number): boolean {
    return selectedRegion?.index === regionIndex;
  }

  function isRegionOccupied(regionIndex: number): boolean {
    return getRegionOwner(regionIndex) !== null;
  }
</script>

<div class="game-map" bind:this={mapContainer}>
  <svg width="100%" height="100%" viewBox="0 0 {mapWidth} {mapHeight}">
    <!-- Background texture and gradients -->
    <defs>
      <pattern id="mapTexture" patternUnits="userSpaceOnUse" width="30" height="30">
        <rect width="30" height="30" fill="#1e3a8a" opacity="0.05"/>
        <circle cx="15" cy="15" r="1" fill="#3730a3" opacity="0.2"/>
        <circle cx="5" cy="25" r="0.5" fill="#3730a3" opacity="0.1"/>
        <circle cx="25" cy="5" r="0.5" fill="#3730a3" opacity="0.1"/>
      </pattern>

      <!-- Neutral gradient for unoccupied regions -->
      <radialGradient id="neutralGradient" cx="50%" cy="30%">
        <stop offset="0%" stop-color="#9ca3af"/>
        <stop offset="50%" stop-color="#6b7280"/>
        <stop offset="100%" stop-color="#4b5563"/>
      </radialGradient>

      <!-- Dynamic gradients for each region based on owner -->
      {#each enhancedRegions as region}
        <radialGradient id="regionGradient{region.index}" cx="50%" cy="30%">
          <stop offset="0%" stop-color={getRegionColor(region.index)} stop-opacity="0.9"/>
          <stop offset="100%" stop-color={getRegionColor(region.index)} stop-opacity="0.7"/>
        </radialGradient>
      {/each}
    </defs>

    <!-- Ocean background -->
    <rect width={mapWidth} height={mapHeight} fill="#1e3a8a"/>
    <rect width={mapWidth} height={mapHeight} fill="url(#mapTexture)"/>

    <!-- Voronoi regions with true shared borders - no connection lines needed -->
    {#if enhancedRegions.length > 0}
      {#each enhancedRegions as region}
        {@const owner = getRegionOwner(region.index)}
        {@const fillColor = owner ? `url(#regionGradient${region.index})` : 'url(#neutralGradient)'}
        {@const isSelected = isRegionSelected(region.index)}
        {@const isOccupied = isRegionOccupied(region.index)}
        {@const armies = getRegionArmies(region.index)}

        <g>
          <!-- Region boundary with shared borders -->
          <path
            d={region.boundary || ''}
            fill={fillColor}
            stroke={isSelected ? '#fbbf24' : '#1e293b'}
            stroke-width={isSelected ? 4 : 2}
            stroke-linejoin="round"
            opacity={isOccupied ? 1 : 0.8}
            class="region-path"
            role="button"
            tabindex="0"
            on:click={() => handleRegionClick(region)}
            on:keydown={(e) => handleRegionKeydown(e, region)}
          />

          <!-- Subtle highlight border for owned regions -->
          {#if isOccupied}
            <path
              d={region.boundary || ''}
              fill="none"
              stroke={getRegionColor(region.index)}
              stroke-width="1"
              opacity="0.7"
            />
          {/if}

          <!-- Region highlight for selection -->
          {#if isSelected}
            <path
              d={region.boundary || ''}
              fill="none"
              stroke="#fbbf24"
              stroke-width="4"
              opacity="0.6"
              stroke-dasharray="8,4"
              class="selection-highlight"
            />
          {/if}

          <!-- Home region indicator (for setup) -->
          {#if isOccupied && armies >= 3}
            <!-- Castle/fortress icon for home regions -->
            <rect
              x={region.x - 8}
              y={region.y - 8}
              width="16"
              height="16"
              fill="#2d3748"
              stroke={getRegionColor(region.index)}
              stroke-width="2"
              rx="2"
            />

            <!-- Flag on castle -->
            <polygon
              points="{region.x + 4},{region.y - 8} {region.x + 4},{region.y - 4} {region.x + 8},{region.y - 6}"
              fill={getRegionColor(region.index)}
            />
          {/if}

          <!-- Army indicators -->
          {#if armies > 0}
            <!-- Soldier dots for small numbers -->
            {#if armies <= 5}
              {#each Array(armies) as _, i}
                <circle
                  cx={region.x - 6 + (i % 3) * 4}
                  cy={region.y + 8 + Math.floor(i / 3) * 4}
                  r="1.5"
                  fill="white"
                  stroke="#374151"
                  stroke-width="0.5"
                />
              {/each}
            {:else}
              <!-- Number for large armies -->
              <text
                x={region.x}
                y={region.y + 14}
                text-anchor="middle"
                fill="white"
                font-size="10"
                font-weight="bold"
                stroke="#000"
                stroke-width="0.5"
              >
                {armies}
              </text>
            {/if}
          {/if}

          <!-- Temple indicator for neutral regions -->
          {#if region.hasTemple && !isOccupied}
            <polygon
              points="{region.x},{region.y-6} {region.x+4},{region.y+2} {region.x-4},{region.y+2}"
              fill="#fbbf24"
              stroke="#f59e0b"
              stroke-width="1"
            />
          {/if}
        </g>
      {/each}
    {/if}

    <!-- Map info overlay (debug info - can be removed) -->
    {#if enhancedRegions.length > 0}
      <text x="10" y="25" fill="#94a3b8" font-size="12" font-family="monospace">
        Regions: {enhancedRegions.length}
      </text>
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
  }

  .region-path {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .region-path:hover {
    stroke-width: 3;
    filter: brightness(1.1);
  }

  .region-path:focus {
    outline: none;
    stroke: #fbbf24;
    stroke-width: 3;
  }

  .selection-highlight {
    pointer-events: none;
    animation: dash 2s linear infinite;
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
