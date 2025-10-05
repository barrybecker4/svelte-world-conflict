<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Region, GameStateData } from '$lib/game/entities/gameTypes';
  import Temple from './Temple.svelte';
  import Army from './Army.svelte';
  import regionUtil from './regionUtil';

  export let region: Region;
  export let gameState: GameStateData | null = null;
  export let isValidTarget: boolean = false;
  export let isPreviewMode: boolean = false;
  export let canHighlight: boolean = false;
  export let highlightVisible: boolean = true;
  export let isBattleInProgress: boolean = false;
  export let fillColor: string = '#8b92a0';
  export let borderColor: string = '#4a5568';
  export let borderWidth: number = 1;
  export let onRegionClick: (region: Region) => void = () => {};

  $: regionPath = region.points
    ? regionUtil.pointsToPath(region.points)
    : regionUtil.createFallbackCircle(region);

  $: hasTemple = gameState?.templesByRegion?.[region.index] !== undefined;
  $: soldierCount = gameState?.soldiersByRegion?.[region.index]?.length || 0;
  $: templeData = gameState?.templesByRegion?.[region.index];

  $: pathClass = [
    'region-path',
    isPreviewMode && 'preview-mode',
    canHighlight && 'can-move',
    isValidTarget && 'valid-target',
    isBattleInProgress && 'battle-in-progress'
  ].filter(Boolean).join(' ');

  $: filterValue = isBattleInProgress ? 'url(#battle-glow)' : undefined;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRegionClick(region);
    }
  }
</script>

<g class="region-group">
  <!-- Main region path -->
  <path
    d={regionPath}
    fill={fillColor}
    stroke={borderColor}
    stroke-width={borderWidth}
    class={pathClass}
    filter={filterValue}
    role="button"
    tabindex={isPreviewMode ? -1 : 0}
    aria-label={`Region ${region.index}`}
    on:click={() => onRegionClick(region)}
    on:keydown={handleKeyDown}
  />

  <!-- Pulse overlay for highlighting -->
  {#if canHighlight}
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

  <!-- Region content (temples and armies) -->
  <g class="region-content">
    {#if hasTemple && templeData}
      <Temple
        x={region.x}
        y={region.y}
        upgradeLevel={templeData.level || 0}
        isPlayerOwned={gameState?.ownersByRegion?.[region.index] !== undefined}
        regionIndex={region.index}
      />
    {/if}

    {#if soldierCount > 0}
      <Army
        x={region.x}
        y={region.y}
        armyCount={soldierCount}
        hasTemple={hasTemple}
      />
    {/if}
  </g>
</g>

<style>
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

  .region-path.valid-target {
    stroke: #fbbf24;
    stroke-width: 2;
    stroke-dasharray: 4 2;
    animation: highlight-pulse 1.5s ease-in-out infinite;
  }

  @keyframes highlight-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
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
</style>
