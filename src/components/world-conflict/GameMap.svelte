<script lang="ts">
  import { onMount } from 'svelte';
  import type { Region } from '$lib/game/classes/Region';
  import type { Player } from '$lib/game/types';

  export let regions: Region[] = [];
  export let gameState: any = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let selectedRegion: Region | null = null;

  let mapContainer: HTMLDivElement;
  let mapWidth = 800;
  let mapHeight = 600;

  // Sample regions for development (you'll replace with actual world map data)
  const sampleRegions = [
    { index: 0, name: 'North America', x: 200, y: 150, neighbors: [1, 2] },
    { index: 1, name: 'Europe', x: 400, y: 120, neighbors: [0, 2, 3] },
    { index: 2, name: 'Asia', x: 600, y: 180, neighbors: [0, 1, 3] },
    { index: 3, name: 'Africa', x: 450, y: 350, neighbors: [1, 2, 4] },
    { index: 4, name: 'South America', x: 250, y: 400, neighbors: [0, 3] },
    { index: 5, name: 'Australia', x: 650, y: 450, neighbors: [2] }
  ];

  onMount(() => {
    if (regions.length === 0) {
      regions = sampleRegions;
    }
  });

  function getRegionOwner(regionIndex: number): Player | null {
    return gameState?.owners?.[regionIndex] !== undefined
      ? gameState.players[gameState.owners[regionIndex]]
      : null;
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

  function isRegionSelected(regionIndex: number): boolean {
    return selectedRegion?.index === regionIndex;
  }
</script>

<div class="game-map" bind:this={mapContainer}>
  <svg width={mapWidth} height={mapHeight} viewBox="0 0 {mapWidth} {mapHeight}">
    <!-- Region connections -->
    {#each regions as region}
      {#each region.neighbors as neighborIndex}
        {#if regions[neighborIndex]}
          <line
            x1={region.x}
            y1={region.y}
            x2={regions[neighborIndex].x}
            y2={regions[neighborIndex].y}
            stroke="#374151"
            stroke-width="2"
            opacity="0.3"
          />
        {/if}
      {/each}
    {/each}

    <!-- Regions -->
    {#each regions as region}
      <g>
        <!-- Region circle -->
        <circle
          cx={region.x}
          cy={region.y}
          r="40"
          fill={getRegionColor(region.index)}
          stroke={isRegionSelected(region.index) ? '#fbbf24' : '#374151'}
          stroke-width={isRegionSelected(region.index) ? '4' : '2'}
          class="region-circle"
          class:selected={isRegionSelected(region.index)}
          on:click={() => handleRegionClick(region)}
        />

        <!-- Region name -->
        <text
          x={region.x}
          y={region.y - 50}
          text-anchor="middle"
          class="region-name"
          fill="#1f2937"
          font-size="12"
          font-weight="bold"
        >
          {region.name}
        </text>

        <!-- Army count -->
        <text
          x={region.x}
          y={region.y + 5}
          text-anchor="middle"
          class="army-count"
          fill="white"
          font-size="16"
          font-weight="bold"
        >
          {getRegionArmies(region.index)}
        </text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .game-map {
    background: linear-gradient(135deg, #1e40af 0%, #3730a3 100%);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .region-circle {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .region-circle:hover {
    stroke-width: 3;
    filter: brightness(1.1);
  }

  .region-circle.selected {
    animation: pulse 1.5s ease-in-out infinite;
  }

  .region-name {
    pointer-events: none;
    user-select: none;
  }

  .army-count {
    pointer-events: none;
    user-select: none;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @media (max-width: 768px) {
    .game-map {
      padding: 0.5rem;
    }
  }
</style>
