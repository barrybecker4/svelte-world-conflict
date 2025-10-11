<script lang="ts">
  import { getPlayerMapColor } from '$lib/game/constants/playerConfigs';
  import type { GameStateData } from '$lib/game/entities/gameTypes';

  export let gameState: GameStateData | null = null;
  export let battlesInProgress: Set<number>;
</script>

<defs>
  <!-- Drop shadow for region borders -->
  <filter id="regionShadow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="4" dy="4" stdDeviation="3" flood-color="#000000" flood-opacity="0.6"/>
  </filter>

  <!-- Battle progress patterns -->
  {#each Array.from(battlesInProgress) as regionIndex}
    <pattern id="battlePattern{regionIndex}" patternUnits="userSpaceOnUse" width="40" height="40">
      <rect width="40" height="40" fill="{getPlayerMapColor(gameState?.ownersByRegion?.[regionIndex] || 0)}" opacity="0.7"/>
      <rect width="40" height="40" fill="none" stroke="#ff6b35" stroke-width="3" stroke-dasharray="10,5"/>
      <circle cx="20" cy="20" r="8" fill="#ff6b35" opacity="0.6"/>
    </pattern>
  {/each}

  <!-- Battle glow effect -->
  <filter id="battleGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
    <feColorMatrix type="matrix" values="1 0.3 0 0 0  0.3 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
  
  <!-- Brightness filter for highlighted regions (no shadow - applied to group) -->
  <filter id="brightenRegion" x="-50%" y="-50%" width="200%" height="200%">
    <feComponentTransfer>
      <feFuncR type="linear" slope="1.4"/>
      <feFuncG type="linear" slope="1.4"/>
      <feFuncB type="linear" slope="1.4"/>
    </feComponentTransfer>
  </filter>
</defs>
