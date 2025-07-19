<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';

  export let regions: Region[] = [];
  export let gameState: WorldConflictGameStateData | null = null;
  export const currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;

  let mapContainer: HTMLDivElement;
  let mapWidth = 800;
  let mapHeight = 600;

  // Adjust polygon size based on number of regions
  $: baseRadius = calculateBaseRadius(regions.length);

  // Enhanced region interface with boundary data
  interface EnhancedRegion extends Region {
    boundary?: string;
  }

  // Generate a realistic 30-region map that forms a connected landmass
  const generateConnectedMap = (): Region[] => {
    const regions: Region[] = [];
    const gridWidth = 6;
    const gridHeight = 5;
    const cellWidth = mapWidth / (gridWidth + 1);
    const cellHeight = mapHeight / (gridHeight + 1);

    // Create a grid-based layout with some randomization
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const index = row * gridWidth + col;

        // Add some randomization to positions while keeping them roughly in grid
        const baseX = (col + 1) * cellWidth;
        const baseY = (row + 1) * cellHeight;
        const offsetX = (Math.random() - 0.5) * cellWidth * 0.4;
        const offsetY = (Math.random() - 0.5) * cellHeight * 0.4;

        regions.push({
          index,
          name: generateRegionName(index),
          x: Math.round(baseX + offsetX),
          y: Math.round(baseY + offsetY),
          neighbors: [],
          hasTemple: Math.random() < 0.25 // 25% chance of temple
        });
      }
    }

    // Connect neighbors based on proximity (grid-like but with some variation)
    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const row = Math.floor(i / gridWidth);
      const col = i % gridWidth;

      // Add grid neighbors
      const potentialNeighbors = [
        (row - 1) * gridWidth + col,     // North
        (row + 1) * gridWidth + col,     // South
        row * gridWidth + (col - 1),     // West
        row * gridWidth + (col + 1),     // East
      ];

      // Add diagonal neighbors sometimes for more interesting connections
      if (Math.random() < 0.3) {
        potentialNeighbors.push((row - 1) * gridWidth + (col - 1)); // NW
      }
      if (Math.random() < 0.3) {
        potentialNeighbors.push((row - 1) * gridWidth + (col + 1)); // NE
      }
      if (Math.random() < 0.3) {
        potentialNeighbors.push((row + 1) * gridWidth + (col - 1)); // SW
      }
      if (Math.random() < 0.3) {
        potentialNeighbors.push((row + 1) * gridWidth + (col + 1)); // SE
      }

      for (const neighborIndex of potentialNeighbors) {
        if (neighborIndex >= 0 && neighborIndex < regions.length && neighborIndex !== i) {
          const neighbor = regions[neighborIndex];
          const distance = Math.sqrt(
            Math.pow(region.x - neighbor.x, 2) + Math.pow(region.y - neighbor.y, 2)
          );

          // Connect if close enough
          if (distance < cellWidth * 1.5) {
            if (!region.neighbors.includes(neighborIndex)) {
              region.neighbors.push(neighborIndex);
            }
            if (!neighbor.neighbors.includes(i)) {
              neighbor.neighbors.push(i);
            }
          }
        }
      }
    }

    return regions;
  };

  // Generate fantasy region names
  const generateRegionName = (index: number): string => {
    const prefixes = ['North', 'South', 'East', 'West', 'Upper', 'Lower', 'Great', 'Little', 'Old', 'New'];
    const roots = ['haven', 'shire', 'moor', 'vale', 'burg', 'ford', 'ton', 'wood', 'fell', 'marsh', 'peak', 'ridge', 'glen', 'holm', 'gate'];
    const suffixes = ['lands', 'heim', 'stad', 'mark', 'wick', 'thorpe', 'by', 'garth'];

    // Some regions get single names, others get compound names
    if (Math.random() < 0.3) {
      return roots[index % roots.length].charAt(0).toUpperCase() + roots[index % roots.length].slice(1);
    } else {
      const prefix = prefixes[index % prefixes.length];
      const suffix = Math.random() < 0.5 ? roots[index % roots.length] : suffixes[index % suffixes.length];
      return `${prefix}${suffix}`;
    }
  };

  // Calculate appropriate polygon size based on region count
  function calculateBaseRadius(regionCount: number): number {
    // Scale polygon size inversely with region count
    if (regionCount <= 15) return 45;      // Small maps - larger regions
    if (regionCount <= 20) return 40;      // Medium maps
    return 35;                             // Large maps - smaller regions
  }

  // Generate irregular boundaries using a more realistic approach
  function generateIrregularBoundary(
    region: Region,
    allRegions: Region[],
    mapWidth: number,
    mapHeight: number
  ): string {
    const centerX = region.x;
    const centerY = region.y;

    // Calculate appropriate radius based on regional density
    const neighborDistances = region.neighbors.map(nIndex => {
      const neighbor = allRegions.find(r => r.index === nIndex);
      if (neighbor) {
        return Math.sqrt(Math.pow(region.x - neighbor.x, 2) + Math.pow(region.y - neighbor.y, 2));
      }
      return 100;
    });

    const avgNeighborDistance = neighborDistances.length > 0
      ? neighborDistances.reduce((a, b) => a + b, 0) / neighborDistances.length
      : 80;

    const regionBaseRadius = Math.min(avgNeighborDistance * 0.45, baseRadius);

    // Create boundary points
    const points: Array<{x: number, y: number}> = [];
    const numPoints = 8 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;

      // Vary radius for irregular shape
      const radiusVariation = 0.7 + Math.random() * 0.6;
      const radius = regionBaseRadius * radiusVariation;

      // Add angular noise
      const angleNoise = (Math.random() - 0.5) * 0.4;
      const finalAngle = angle + angleNoise;

      let x = centerX + Math.cos(finalAngle) * radius;
      let y = centerY + Math.sin(finalAngle) * radius;

      // Keep within bounds
      x = Math.max(20, Math.min(mapWidth - 20, x));
      y = Math.max(20, Math.min(mapHeight - 20, y));

      points.push({ x, y });
    }

    // Create smooth path
    if (points.length === 0) return '';

    let path = `M ${points[0].x},${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[(i + 1) % points.length];

      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y + (curr.y - prev.y) * 0.5;

      path += ` Q ${cp1x},${cp1y} ${curr.x},${curr.y}`;
    }

    // Close path
    const first = points[0];
    const last = points[points.length - 1];
    const cp1x = last.x + (first.x - last.x) * 0.5;
    const cp1y = last.y + (first.y - last.y) * 0.5;

    path += ` Q ${cp1x},${cp1y} ${first.x},${first.y} Z`;

    return path;
  }

  // Enhanced regions with boundary data
  let enhancedRegions: EnhancedRegion[] = [];

  onMount(() => {
    if (regions.length === 0) {
      regions = generateConnectedMap();
    }

    // Generate boundaries for all regions
    enhancedRegions = regions.map(region => ({
      ...region,
      boundary: generateIrregularBoundary(region, regions, mapWidth, mapHeight)
    }));
  });

  function getRegionOwner(regionIndex: number): Player | null {
    if (!gameState?.owners || gameState.owners[regionIndex] === undefined || gameState.owners[regionIndex] === -1) {
      return null;
    }
    const playerIndex = gameState.owners[regionIndex];
    return gameState.players[playerIndex] || null;
  }

  function getRegionColor(regionIndex: number): string {
    const owner = getRegionOwner(regionIndex);
    if (!owner) return '#6b7280'; // neutral gray for unoccupied regions

    const playerColors = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];
    return playerColors[owner.index % playerColors.length];
  }

  function getRegionArmies(regionIndex: number): number {
    // Handle both array format and object format
    const soldiers = gameState?.soldiersByRegion?.[regionIndex];
    if (Array.isArray(soldiers)) {
      return soldiers.length || 1;
    }
    return 1; // Default to 1 army if no data
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
  <svg width={mapWidth} height={mapHeight} viewBox="0 0 {mapWidth} {mapHeight}">
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

    <!-- Debug info (remove in production) -->
    {#if enhancedRegions.length > 0}
      <text x="10" y="25" fill="#94a3b8" font-size="12" font-family="monospace">
        Regions: {enhancedRegions.length} | Occupied: {Object.keys(gameState?.owners || {}).length} | Neutral: {enhancedRegions.length - Object.keys(gameState?.owners || {}).length}
      </text>
    {/if}

    <!-- Region connections (drawn behind regions) -->
    <g opacity="0.4">
      {#each enhancedRegions as region}
        {#each region.neighbors as neighborIndex}
          {@const neighbor = enhancedRegions.find(r => r.index === neighborIndex)}
          {#if neighbor && neighborIndex > region.index}
            <!-- Only draw each connection once by checking neighborIndex > region.index -->
            <line
              x1={region.x}
              y1={region.y}
              x2={neighbor.x}
              y2={neighbor.y}
              stroke="#374151"
              stroke-width="1"
              opacity="0.6"
            />
          {/if}
        {/each}
      {/each}
    </g>

    <!-- Region polygons -->
    {#if enhancedRegions.length > 0}
      {#each enhancedRegions as region}
        {@const owner = getRegionOwner(region.index)}
        {@const fillColor = owner ? `url(#regionGradient${region.index})` : 'url(#neutralGradient)'}
        {@const isSelected = isRegionSelected(region.index)}
        {@const isOccupied = isRegionOccupied(region.index)}

        <g>
          <!-- Region boundary -->
          <path
            d={region.boundary}
            fill={fillColor}
            stroke={isSelected ? '#fbbf24' : (isOccupied ? '#374151' : '#64748b')}
            stroke-width={isSelected ? 3 : (isOccupied ? 2 : 1)}
            class="region-path"
            class:selected={isSelected}
            class:neutral={!isOccupied}
            role="button"
            tabindex="0"
            aria-label={`Region ${region.name}, armies: ${getRegionArmies(region.index)}, owner: ${owner?.name || 'neutral'}`}
            on:click={() => handleRegionClick(region)}
            on:keydown={(event) => handleRegionKeydown(event, region)}
          />

          <!-- Temple indicator -->
          {#if region.hasTemple}
            <g class="temple-indicator">
              <circle
                cx={region.x + 18}
                cy={region.y - 18}
                r="6"
                fill="#fbbf24"
                stroke="#92400e"
                stroke-width="1"
                aria-label="Temple site"
              />
              <text
                x={region.x + 18}
                y={region.y - 15}
                text-anchor="middle"
                font-size="8"
                fill="#92400e"
                font-weight="bold"
              >
                ⛩
              </text>
            </g>
          {/if}

          <!-- Region name (smaller for many regions) -->
          <text
            x={region.x}
            y={region.y - 25}
            text-anchor="middle"
            class="region-name"
            fill="#f8fafc"
            font-size="10"
            font-weight="bold"
          >
            {region.name}
          </text>

          <!-- Army count circle and number -->
          <circle
            cx={region.x}
            cy={region.y}
            r="12"
            fill="rgba(0,0,0,0.8)"
            stroke={isOccupied ? "#fff" : "#94a3b8"}
            stroke-width="1.5"
            class="army-circle"
          />
          <text
            x={region.x}
            y={region.y + 3}
            text-anchor="middle"
            class="army-count"
            fill="white"
            font-size="11"
            font-weight="bold"
          >
            {getRegionArmies(region.index)}
          </text>
        </g>
      {/each}
    {:else}
      <!-- Empty state -->
      <text x={mapWidth/2} y={mapHeight/2} text-anchor="middle" fill="#94a3b8" font-size="16">
        No regions loaded
      </text>
    {/if}
  </svg>
</div>

<style>
  .game-map {
    background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .region-path {
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
  }

  .region-path:hover,
  .region-path:focus {
    stroke-width: 3;
    filter: brightness(1.15);
  }

  .region-path.neutral:hover {
    fill: #7c8694;
  }

  .region-path:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  .region-path.selected {
    animation: pulse 1.5s ease-in-out infinite;
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
  }

  .temple-indicator {
    pointer-events: none;
    animation: glow 3s ease-in-out infinite alternate;
  }

  .region-name {
    pointer-events: none;
    user-select: none;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.9);
  }

  .army-count, .army-circle {
    pointer-events: none;
    user-select: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  @keyframes glow {
    from {
      filter: drop-shadow(0 0 1px #fbbf24);
    }
    to {
      filter: drop-shadow(0 0 4px #fbbf24);
    }
  }

  @media (max-width: 768px) {
    .game-map {
      padding: 0.5rem;
    }
  }
</style>
