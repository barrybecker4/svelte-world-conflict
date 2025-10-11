<script lang="ts">
  import type { Region, GameStateData } from '$lib/game/entities/gameTypes';
  import Temple from './Temple.svelte';
  import Army from './Army.svelte';
  import regionUtil from './regionUtil';
  import { TEMPLE_UPGRADES } from '$lib/game/constants/templeUpgradeDefinitions';

  export let region: Region;
  export let gameState: GameStateData | null = null;
  export let isValidTarget: boolean = false;
  export let isSelected: boolean = false;
  export let isPreviewMode: boolean = false;
  export let canHighlight: boolean = false;
  export let isBattleInProgress: boolean = false;
  export let fillColor: string = '#8b92a0';
  export let borderColor: string = '#4a5568';
  export let borderWidth: number = 1;
  export let innerBorderColor: string = '';
  export let innerBorderWidth: number = 8;
  export let isClickable: boolean = true;
  export let onRegionClick: (region: Region) => void = () => {};
  export let onTempleClick: (regionIndex: number) => void = () => {};

  $: regionPath = region.points
    ? regionUtil.pointsToPath(region.points)
    : regionUtil.createFallbackCircle(region);

  $: hasTemple = gameState?.templesByRegion?.[region.index] !== undefined;
  $: soldierCount = gameState?.soldiersByRegion?.[region.index]?.length || 0;
  $: templeData = gameState?.templesByRegion?.[region.index];
  $: upgradeType = templeData?.upgradeIndex !== undefined 
    ? TEMPLE_UPGRADES[templeData.upgradeIndex]?.name 
    : undefined;

  $: pathClass = [
    'region-path',
    isPreviewMode && 'preview-mode',
    !isClickable && 'not-clickable',
    canHighlight && 'can-move',
    isValidTarget && 'valid-target',
    isBattleInProgress && 'battle-in-progress'
  ].filter(Boolean).join(' ');

  $: effectiveFilter = isBattleInProgress 
    ? 'url(#battleGlow)' 
    : canHighlight 
      ? 'url(#brightenRegion)' 
      : undefined;

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
    filter={effectiveFilter}
    role="button"
    tabindex={isPreviewMode ? -1 : 0}
    aria-label={`Region ${region.index}`}
    on:click={() => onRegionClick(region)}
    on:keydown={handleKeyDown}
  />

  <!-- Inner border highlight for movable and valid target regions -->
  {#if (isSelected || canHighlight || isValidTarget) && innerBorderColor}
    <defs>
      <clipPath id="clip-{region.index}">
        <path d={regionPath} />
      </clipPath>
    </defs>
    <path
      d={regionPath}
      fill="none"
      stroke={innerBorderColor}
      stroke-width={innerBorderWidth}
      class="inner-border"
      style="pointer-events: none;"
      clip-path="url(#clip-{region.index})"
      stroke-linejoin="round"
    />
  {/if}

  <!-- Region content (temples and armies) -->
  <g class="region-content">
    {#if hasTemple && templeData}
      <Temple
        x={region.x}
        y={region.y}
        upgradeLevel={templeData.level || 0}
        upgradeType={upgradeType}
        isPlayerOwned={gameState?.ownersByRegion?.[region.index] !== undefined}
        regionIndex={region.index}
        {onTempleClick}
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
  }

  .region-path.preview-mode,
  .region-path.not-clickable {
    cursor: default;
  }

  .region-path:hover:not(.preview-mode):not(.not-clickable) {
    opacity: 0.9;
  }

  .region-path:focus:not(.preview-mode):not(.not-clickable) {
    outline: none;
  }

  .region-path.can-move {
    cursor: pointer;
  }

  .region-path.valid-target {
    cursor: pointer;
  }

  .inner-border {
    pointer-events: none;
  }
</style>
