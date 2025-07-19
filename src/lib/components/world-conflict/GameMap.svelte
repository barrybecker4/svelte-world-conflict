<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region, Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState';

  export let regions: Region[] = [];
  export let gameState: WorldConflictGameStateData | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;
  export let moveMode: string = 'IDLE';

  let mapContainer: HTMLDivElement;
  let mapWidth = 300;
  let mapHeight = 250;

  // Cache for generated polygon paths
  let regionPolygons: Map<number, string> = new Map();

  onMount(() => {
    if (regions.length > 0) {
      generateRegionPolygons();
    }
  });

  // Regenerate when regions change
  $: if (regions.length > 0) {
    generateRegionPolygons();
  }

  function generateRegionPolygons() {
    console.log('Generating simple irregular polygons for', regions.length, 'regions');

    regionPolygons.clear();

    regions.forEach(region => {
      const polygon = generateSimpleIrregularPolygon(region.x, region.y, region.index);
      regionPolygons.set(region.index, polygon);
    });

    regionPolygons = regionPolygons; // Trigger reactivity
    console.log('Generated polygons for', regions.length, 'regions');
  }

  function generateSimpleIrregularPolygon(centerX: number, centerY: number, seed: number): string {
    const points: { x: number; y: number }[] = [];
    const numPoints = 6 + (seed % 3); // 6-8 points for variety
    const baseRadius = 25; // Fixed size that works well in the 300x250 viewBox

    // Seeded random for consistent polygons
    let randomSeed = seed * 12345;
    const seededRandom = () => {
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };

    // Generate points in a circle with random variation
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;

      // Add randomness to radius for irregular shape
      const radiusVariation = 0.7 + seededRandom() * 0.6; // 70-130% of base radius
      const radius = baseRadius * radiusVariation;

      // Small random angle variation
      const angleVariation = (seededRandom() - 0.5) * 0.3;
      const finalAngle = angle + angleVariation;

      const x = centerX + Math.cos(finalAngle) * radius;
      const y = centerY + Math.sin(finalAngle) * radius;

      points.push({ x, y });
    }

    // Create smooth SVG path
    if (points.length === 0) return '';

    let path = `M ${points[0].x},${points[0].y}`;

    // Use smooth curves between points
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];

      // Create smooth curve to next point
      const cp1x = current.x + (next.x - current.x) * 0.5;
      const cp1y = current.y + (next.y - current.y) * 0.5;

      if (i === points.length - 1) {
        // Close back to start
        path += ` Q ${cp1x},${cp1y} ${points[0].x},${points[0].y}`;
      } else {
        path += ` Q ${cp1x},${cp1y} ${next.x},${next.y}`;
      }
    }

    path += ' Z';
    return path;
  }

  function getRegionOwner(regionIndex: number): Player | null {
    if (!gameState?.owners || gameState.owners[regionIndex] === undefined) {
      return null;
    }
    const playerIndex = gameState.owners[regionIndex];
    return gameState.players[playerIndex] || null;
  }

  function getRegionColor(regionIndex: number): string {
    const owner = getRegionOwner(regionIndex);
    if (!owner) return '#94a3b8'; // neutral gray

    const playerColors = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];
    return playerColors[owner.index % playerColors.length];
  }

  function getRegionArmies(regionIndex: number): number {
    return gameState?.soldiersByRegion?.[regionIndex]?.length || 0;
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

  function getStrokeColor(regionIndex: number): string {
    if (isRegionSelected(regionIndex)) return '#fbbf24';
    if (moveMode !== 'IDLE') return '#60a5fa';
    return '#374151';
  }

  function getStrokeWidth(regionIndex: number): string {
    return isRegionSelected(regionIndex) ? '3' : '2';
  }
</script>

<div class="game-map" bind:this={mapContainer}>
  <svg width={mapWidth} height={mapHeight} viewBox="0 0 {mapWidth} {mapHeight}">
    <defs>
      <!-- Map background gradient -->
      <radialGradient id="mapBackground" cx="50%" cy="50%" r="70%">
        <stop offset="0%" style="stop-color:#1e40af;stop-opacity:0.1" />
        <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:0.3" />
      </radialGradient>

      <!-- Glow filter for selected regions -->
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Drop shadow for depth -->
      <filter id="shadow">
        <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
      </filter>
    </defs>

    <!-- Map background -->
    <rect width="100%" height="100%" fill="url(#mapBackground)" />

    <!-- Region connections (draw first so they appear behind regions) -->
    {#each regions as region}
      {#each region.neighbors as neighborIndex}
        {@const neighbor = regions.find(r => r.index === neighborIndex)}
        {#if neighbor}
          <line
            x1={region.x}
            y1={region.y}
            x2={neighbor.x}
            y2={neighbor.y}
            stroke="#374151"
            stroke-width="1"
            opacity="0.3"
            class="connection-line"
          />
        {/if}
      {/each}
    {/each}

    <!-- Regions with individual irregular polygons -->
    {#each regions as region}
      {@const polygon = regionPolygons.get(region.index)}
      {#if polygon}
        <g class="region-group">
          <!-- Main region polygon -->
          <path
            d={polygon}
            fill={getRegionColor(region.index)}
            stroke={getStrokeColor(region.index)}
            stroke-width={getStrokeWidth(region.index)}
            filter="url(#shadow)"
            class="region-polygon"
            class:selected={isRegionSelected(region.index)}
            class:neutral={!getRegionOwner(region.index)}
            class:interactive={moveMode !== 'IDLE'}
            role="button"
            tabindex="0"
            aria-label={`Region ${region.index}, armies: ${getRegionArmies(region.index)}`}
            on:click={() => handleRegionClick(region)}
            on:keydown={(event) => handleRegionKeydown(event, region)}
          />

          <!-- Highlight overlay for selected regions -->
          {#if isRegionSelected(region.index)}
            <path
              d={polygon}
              fill="none"
              stroke="#fbbf24"
              stroke-width="4"
              opacity="0.6"
              filter="url(#glow)"
              class="selection-highlight"
              pointer-events="none"
            />
          {/if}

          <!-- Temple indicator -->
          {#if region.hasTemple}
            <circle
              cx={region.x + 12}
              cy={region.y - 12}
              r="4"
              fill="#fbbf24"
              stroke="#92400e"
              stroke-width="1"
              class="temple-indicator"
              aria-label="Temple site"
            />
          {/if}

          <!-- Army count -->
          <text
            x={region.x}
            y={region.y + 3}
            text-anchor="middle"
            class="army-count"
            fill="#ffffff"
            font-size="14"
            font-weight="bold"
            text-shadow="1px 1px 2px rgba(0,0,0,0.8)"
            pointer-events="none"
          >
            {getRegionArmies(region.index)}
          </text>
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .game-map {
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.8);
    border-radius: 1rem;
    border: 1px solid #475569;
    overflow: hidden;
  }

  .region-polygon {
    cursor: pointer;
    transition: all 0.3s ease;
    outline: none;
  }

  .region-polygon:hover {
    filter: brightness(1.15) saturate(1.1) url(#shadow);
  }

  .region-polygon:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .region-polygon.selected {
    animation: pulse 2s ease-in-out infinite;
  }

  .region-polygon.neutral {
    filter: saturate(0.8) url(#shadow);
  }

  .region-polygon.interactive {
    cursor: crosshair;
  }

  .region-polygon.interactive:hover {
    stroke: #60a5fa;
    stroke-width: 3;
  }

  .selection-highlight {
    animation: glow 1s ease-in-out infinite alternate;
  }

  .connection-line {
    pointer-events: none;
  }

  .temple-indicator {
    pointer-events: none;
    animation: templeGlow 3s ease-in-out infinite alternate;
  }

  .army-count {
    pointer-events: none;
    user-select: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.85;
      transform: scale(1.02);
    }
  }

  @keyframes glow {
    from {
      opacity: 0.4;
    }
    to {
      opacity: 0.8;
    }
  }

  @keyframes templeGlow {
    from {
      filter: drop-shadow(0 0 1px #fbbf24);
    }
    to {
      filter: drop-shadow(0 0 4px #fbbf24);
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .army-count {
      font-size: 12px;
    }
  }
</style>
