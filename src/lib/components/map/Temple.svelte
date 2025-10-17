<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TEMPLE_UPGRADES_BY_NAME, DEFAULT_TEMPLE_COLORS } from '$lib/game/constants/templeUpgradeDefinitions';

  export let x: number;
  export let y: number;
  export let upgradeLevel: number = 0;
  export let upgradeType: string | undefined = undefined; // WATER, FIRE, AIR, EARTH
  export let isPlayerOwned: boolean = false;
  export let regionIndex: number;
  export let onTempleClick: (regionIndex: number) => void = () => {};

  let showGlow = false;

  // Get color scheme from upgrade definitions
  $: colorScheme = upgradeType && TEMPLE_UPGRADES_BY_NAME[upgradeType]?.templeColors
    ? TEMPLE_UPGRADES_BY_NAME[upgradeType].templeColors!
    : DEFAULT_TEMPLE_COLORS;
    
  $: baseColor = colorScheme.base;
  $: darkColor = colorScheme.dark;
  $: lightColor = colorScheme.light;
  $: discColor = colorScheme.disc;

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    onTempleClick(regionIndex);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onTempleClick(regionIndex);
    }
  }

  function handleHighlightRegion(event: CustomEvent) {
    const { regionIndex: highlightedRegion, actionType, duration } = event.detail;
    
    if (highlightedRegion === regionIndex && actionType === 'upgrade') {
      // Trigger glow animation
      showGlow = true;
      
      // Remove glow after animation completes
      setTimeout(() => {
        showGlow = false;
      }, duration || 2000);
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('highlightRegion', handleHighlightRegion as EventListener);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('highlightRegion', handleHighlightRegion as EventListener);
    }
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!-- svelte-ignore a11y-noninteractive-tabindex -->
<g 
  class="temple-group" 
  class:clickable={isPlayerOwned}
  class:glowing={showGlow}
  role={isPlayerOwned ? "button" : "img"}
  tabindex={isPlayerOwned ? 0 : -1}
  aria-label="Temple in region {regionIndex + 1}, level {upgradeLevel}"
  on:click={handleClick}
  on:keydown={handleKeyDown}
>
  <!-- Temple shadow (for 3D effect) -->
  <ellipse
    cx={x + 1}
    cy={y + 8}
    rx="7"
    ry="3"
    fill="rgba(0,0,0,0.2)"
  />

  <!-- Main temple base (larger foundation) -->
  <ellipse
    cx={x}
    cy={y + 6}
    rx="6"
    ry="2.5"
    fill={darkColor}
    stroke={darkColor}
    stroke-width="0.5"
  />

  <!-- Temple main body -->
  <polygon
    points="{x-5},{y+6} {x-3},{y-4} {x+3},{y-4} {x+5},{y+6}"
    fill={baseColor}
    stroke={darkColor}
    stroke-width="1"
  />

  <!-- Temple top highlight (3D lighting effect) -->
  <polygon
    points="{x-3},{y-4} {x-1},{y-6} {x+1},{y-6} {x+3},{y-4}"
    fill={lightColor}
    stroke={darkColor}
    stroke-width="0.5"
  />

  <!-- Side highlight for 3D effect -->
  <polygon
    points="{x-5},{y+6} {x-3},{y-4} {x-1},{y-2} {x-3},{y+6}"
    fill={lightColor}
    opacity="0.6"
  />

  <!-- Upgrade level indicators (stacked disks) -->
  <!-- Show first disc when temple has an upgrade (level 0+) -->
  {#if upgradeType}
    <!-- First upgrade disk -->
    <ellipse
      cx={x}
      cy={y - 7}
      rx="2.5"
      ry="1"
      fill={discColor}
      stroke={darkColor}
      stroke-width="0.5"
    />
    <!-- Highlight on first disk -->
    <ellipse
      cx={x - 0.5}
      cy={y - 7.5}
      rx="1.5"
      ry="0.5"
      fill={lightColor}
      opacity="0.8"
    />

    <!-- Show second disc when temple is upgraded to level 1 (Cathedral) -->
    {#if upgradeLevel >= 1}
      <!-- Second upgrade disk (smaller, on top) -->
      <ellipse
        cx={x}
        cy={y - 9}
        rx="2"
        ry="0.8"
        fill={discColor}
        stroke={darkColor}
        stroke-width="0.5"
      />
      <!-- Highlight on second disk -->
      <ellipse
        cx={x - 0.3}
        cy={y - 9.3}
        rx="1.2"
        ry="0.4"
        fill={lightColor}
        opacity="0.8"
      />
    {/if}
  {/if}

  <!-- Temple entrance (dark doorway) -->
  <rect
    x={x - 1}
    y={y + 2}
    width="2"
    height="3"
    fill={darkColor}
    rx="1"
  />
</g>

<style>
  .temple-group.clickable {
    cursor: pointer;
  }

  .temple-group.clickable:hover {
    filter: brightness(1.2);
  }

  .temple-group:not(.clickable):hover {
    filter: brightness(1.1);
  }

  @keyframes templeGlow {
    0% {
      filter: drop-shadow(0 0 2px rgba(255, 215, 0, 0.8)) brightness(1);
    }
    25% {
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 1)) brightness(1.5);
    }
    50% {
      filter: drop-shadow(0 0 12px rgba(255, 215, 0, 1)) brightness(1.8);
    }
    75% {
      filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8)) brightness(1.3);
    }
    100% {
      filter: drop-shadow(0 0 0px rgba(255, 215, 0, 0)) brightness(1);
    }
  }

  .temple-group.glowing {
    animation: templeGlow 2s ease-out forwards;
  }
</style>
