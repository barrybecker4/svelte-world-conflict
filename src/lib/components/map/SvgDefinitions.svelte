<script lang="ts">
  import { getPlayerMapColor } from '$lib/game/constants/playerConfigs';
  import type { GameStateData } from '$lib/game/entities/gameTypes';

  export let gameState: GameStateData | null = null;
  export let battlesInProgress: Set<number>;

  $: activePlayerGradients = gameState?.players ?
    Array.from({length: 6}, (_, i) => {
      const color = getPlayerMapColor(i);
      return `
        <radialGradient id="activePlayerGradient${i}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.9"/>
          <stop offset="70%" style="stop-color:${color};stop-opacity:0.7"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.6"/>
        </radialGradient>
      `;
    }).join('') : '';
</script>

<defs>
  {@html activePlayerGradients}

  <!-- Glow effect for active regions -->
  <filter id="activeGlow">
    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>

  <filter id="highlightGlow">
    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
    <feColorMatrix type="matrix" values="1.2 1.2 0 0 0  1.2 1.2 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>

  <!-- Pulse pattern for active regions -->
  <pattern id="pulsePattern" patternUnits="userSpaceOnUse" width="20" height="20">
    <rect width="20" height="20" fill="rgba(250, 204, 21, 0.3)"/>
    <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(250, 204, 21, 0.6)" stroke-width="2"/>
  </pattern>

  <!-- Battle progress patterns -->
  {#each Array.from(battlesInProgress) as regionIndex}
    <pattern id="battlePattern{regionIndex}" patternUnits="userSpaceOnUse" width="40" height="40">
      <rect width="40" height="40" fill="{getPlayerMapColor(gameState?.ownersByRegion?.[regionIndex] || 0)}" opacity="0.7"/>
      <rect width="40" height="40" fill="none" stroke="#ff6b35" stroke-width="3" stroke-dasharray="10,5">
        <animate attributeName="stroke-dashoffset" values="0;15" dur="1s" repeatCount="indefinite"/>
      </rect>
      <circle cx="20" cy="20" r="8" fill="#ff6b35" opacity="0.6">
        <animate attributeName="r" values="5;12;5" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </pattern>
  {/each}

  <!-- Battle glow effect -->
  <filter id="battleGlow">
    <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
    <feColorMatrix type="matrix" values="1 0.3 0 0 0  0.3 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
