<!-- Temple.svelte -->
<script lang="ts">
  export let x: number;
  export let y: number;
  export let upgradeLevel: number = 0;
  export let isPlayerOwned: boolean = false;
  export let regionIndex: number;

  // Calculate colors based on ownership
  $: baseColor = isPlayerOwned ? "#f59e0b" : "#fbbf24";
  $: darkColor = isPlayerOwned ? "#d97706" : "#f59e0b";
  $: lightColor = isPlayerOwned ? "#fbbf24" : "#fde047";
</script>

<g class="temple-group" role="img" aria-label="Temple in region {regionIndex + 1}, level {upgradeLevel}">
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
  {#if upgradeLevel > 0}
    <!-- First upgrade disk -->
    <ellipse
      cx={x}
      cy={y - 7}
      rx="2.5"
      ry="1"
      fill="#10b981"
      stroke="#047857"
      stroke-width="0.5"
    />
    <!-- Highlight on first disk -->
    <ellipse
      cx={x - 0.5}
      cy={y - 7.5}
      rx="1.5"
      ry="0.5"
      fill="#34d399"
      opacity="0.8"
    />

    {#if upgradeLevel > 1}
      <!-- Second upgrade disk (smaller, on top) -->
      <ellipse
        cx={x}
        cy={y - 9}
        rx="2"
        ry="0.8"
        fill="#8b5cf6"
        stroke="#7c3aed"
        stroke-width="0.5"
      />
      <!-- Highlight on second disk -->
      <ellipse
        cx={x - 0.3}
        cy={y - 9.3}
        rx="1.2"
        ry="0.4"
        fill="#a78bfa"
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
  .temple-group {
    transition: all 0.2s ease;
  }

  .temple-group:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  /* Make temple upgrades glow slightly */
  .temple-group ellipse[fill="#10b981"] {
    filter: drop-shadow(0 0 2px #10b981);
  }

  .temple-group ellipse[fill="#8b5cf6"] {
    filter: drop-shadow(0 0 2px #8b5cf6);
  }
</style>
