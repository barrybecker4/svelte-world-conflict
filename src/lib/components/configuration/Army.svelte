<script lang="ts">
  export let x: number;
  export let y: number;
  export let armyCount: number;
  export let hasTemple: boolean = false;

  const MAX_INDIVIDUAL_ARMIES = 16;
  const ARMIES_PER_ROW = 8;

  $: showIndividualArmies = armyCount <= MAX_INDIVIDUAL_ARMIES && armyCount > 0;
  $: showCountBadge = armyCount > MAX_INDIVIDUAL_ARMIES;
  $: templeOffset = hasTemple ? 15 : 0;
</script>

<!-- Army rendering -->
{#if showCountBadge}
  <!-- Show count for large armies -->
  <circle
    cx={x}
    cy={y + templeOffset}
    r="10"
    fill="rgba(0,0,0,0.7)"
    stroke="#fbfbf4"
    stroke-width="1"
  />
  <text
    x={x}
    y={y + templeOffset + 3}
    text-anchor="middle"
    font-size="10"
    font-weight="bold"
    fill="#fbfbf4"
  >
    {armyCount}
  </text>
{:else if showIndividualArmies}
  <!-- Show individual army markers for smaller counts -->
  {#each Array(armyCount) as _, armyIndex}
    {@const row = Math.floor(armyIndex / ARMIES_PER_ROW)}
    {@const col = armyIndex % ARMIES_PER_ROW}
    {@const offsetX = (col - (Math.min(armyCount, ARMIES_PER_ROW) - 1) / 2) * 3}
    {@const offsetY = row * 3 + templeOffset}

    <circle
      cx={x + offsetX}
      cy={y + offsetY}
      r="1.5"
      fill="#fbfbf4"
      stroke="#333"
      stroke-width="0.3"
    />
  {/each}
{/if}

<style>
  /* Army count styling */
  text {
    font-family: 'Arial', sans-serif;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  }

  circle {
    filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
  }
</style>