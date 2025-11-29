<script lang="ts">
  import type { Region, Player, GameStateData } from '$lib/game/entities/gameTypes';
  import { getPlayerMapColor, getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { TooltipData } from '$lib/client/feedback/TutorialTips';
  import SvgDefinitions from './SvgDefinitions.svelte';
  import RegionRenderer from './RegionRenderer.svelte';
  import Army from './Army.svelte';
  import SmokeLayer from './SmokeLayer.svelte';
  import Tooltip from '../ui/Tooltip.svelte';
  import { logger } from '$lib/game/utils/logger';

  export let regions: Region[] = [];
  export let gameState: GameStateData | null = null;
  export let currentPlayer: Player | null = null;
  export let onRegionClick: (region: Region) => void = () => {};
  export let onTempleClick: (regionIndex: number) => void = () => {};
  export let selectedRegion: Region | null = null;
  export let validTargetRegions: number[] = [];
  export let isPreviewMode = false;
  export let showTurnHighlights: boolean = true;
  export let previewMode: boolean = false;
  export let mapContainer: HTMLElement | undefined = undefined;
  export let tutorialTips: TooltipData[] = [];
  export let onDismissTooltip: (tooltipId: string) => void = () => {};
  export let battleInProgress: boolean = false;

  // Debug tooltips
  $: if (tutorialTips.length > 0) {
    logger.debug('GameMap received tooltips:', tutorialTips);
  }

  const NEUTRAL_COLOR = '#c2b5a3';

  let mapContainerElement: HTMLDivElement;
  let battlesInProgress = new Set<number>();

  // Bind the internal element to the exported prop
  $: if (mapContainerElement && !mapContainer) {
    mapContainer = mapContainerElement;
  }

  $: currentTurnPlayer = gameState?.players?.find(p => p.slotIndex === gameState.currentPlayerSlot) || null;

  // Reactive set of movable region indices
  // Explicitly reference all dependencies so Svelte knows to re-run when they change
  $: movableRegionIndices = (() => {
    // These references ensure Svelte tracks these as dependencies
    const _deps = [showTurnHighlights, effectivePreviewMode, gameState, currentTurnPlayer, currentPlayer, regions];
    void _deps;

    if (!showTurnHighlights || effectivePreviewMode) {
      return new Set<number>();
    }

    return new Set(
      regions
        .filter(region => canHighlightForTurn(region))
        .map(region => region.index)
    );
  })();

  // Auto-detect preview mode
  $: detectedPreviewMode = !currentPlayer && gameState !== null;
  $: effectivePreviewMode = isPreviewMode || detectedPreviewMode || previewMode;

  // Log game end state
  $: if (gameState?.endResult && gameState.endResult !== 'DRAWN_GAME') {
    logger.debug('Game ended. Winner:', gameState.endResult.name, 'slot:', gameState.endResult.slotIndex);
  }

  // Update battles in progress
  $: {
    if (gameState?.battlesInProgress) {
      battlesInProgress = new Set(gameState.battlesInProgress);
    }
  }

  // Reactive map of region colors - forces re-render when gameState.ownersByRegion changes
  // This is needed because Svelte's keyed {#each} doesn't automatically re-evaluate
  // expressions when dependencies outside the loop key change
  $: regionColorMap = (() => {
    const colors: Record<number, string> = {};
    if (!gameState?.ownersByRegion) {
      return colors;
    }
    for (const region of regions) {
      const ownerIndex = gameState.ownersByRegion[region.index];
      if (ownerIndex === undefined || ownerIndex === -1) {
        colors[region.index] = NEUTRAL_COLOR;
      } else {
        const owner = gameState.players?.find(p => p.slotIndex === ownerIndex);
        colors[region.index] = owner ? getPlayerMapColor(owner.slotIndex) : NEUTRAL_COLOR;
      }
    }
    return colors;
  })();

  function getRegionColor(region: Region): string {
    return regionColorMap[region.index] ?? NEUTRAL_COLOR;
  }

  function getBorderColor(region: Region): string {
    if (selectedRegion && selectedRegion.index === region.index) {
      return '#facc15';
    }
    return '#4a5568';
  }

  function getBorderWidth(region: Region): number {
    if (selectedRegion && selectedRegion.index === region.index) {
      return 3;
    }
    return 1;
  }

  function getInnerBorderColor(region: Region, isSelected: boolean = false, isValidTarget: boolean = false, isWinnerRegion: boolean = false): string {
    if (!gameState?.ownersByRegion) {
        return '';
    }

    const ownerIndex = gameState.ownersByRegion[region.index];

    // For winner regions at game end, use bright highlight
    if (isWinnerRegion && gameState.endResult) {
        return '#fff';  // Bright white for winner regions
    }

    // For neutral regions that are valid targets, use the current player's bright color
    if ((ownerIndex === undefined || ownerIndex === -1) && isValidTarget && currentPlayer) {
        const config = getPlayerConfig(currentPlayer.slotIndex);
        return config.highlightEnd;  // Strong highlight for valid targets
    }

    // For neutral regions that aren't valid targets, no highlight
    if (ownerIndex === undefined || ownerIndex === -1) {
        return '';
    }

    const config = getPlayerConfig(ownerIndex);

    // For selected source region, use bright white with slight color tint
    if (isSelected) {
        return '#fff';  // Bright white makes selection very obvious
    }

    // For owned regions that are valid targets, use bright highlight
    if (isValidTarget) {
        return '#ffd700';  // Gold color for valid targets
    }

    // For other movable regions, use bright white to make them clearly visible
    return '#fff';  // Use white instead of subtle highlight color
  }

  function canHighlightForTurn(region: Region): boolean {
    if (!showTurnHighlights || effectivePreviewMode) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;

    // Use currentTurnPlayer derived from gameState for consistent highlighting
    // This avoids timing issues with the currentPlayer prop
    const playerToHighlight = currentTurnPlayer || currentPlayer;
    if (!playerToHighlight) return false;

    // Don't allow highlighting if game has ended
    if (gameState.endResult) return false;

    // Only highlight if it's the current player's turn
    if (playerToHighlight.slotIndex !== gameState.currentPlayerSlot) return false;

    const isOwnedByCurrentPlayer = gameState.ownersByRegion?.[region.index] === gameState.currentPlayerSlot;
    const soldierCount = gameState.soldiersByRegion?.[region.index]?.length || 0;
    const hasMovableSoldiers = soldierCount > 0;

    // Don't highlight regions that were just conquered this turn
    const wasConqueredThisTurn = gameState.conqueredRegions?.includes(region.index) || false;

    return isOwnedByCurrentPlayer && hasMovableSoldiers && !wasConqueredThisTurn;
  }

  function isWinnerRegion(region: Region): boolean {
    if (!gameState?.endResult || gameState.endResult === 'DRAWN_GAME') {
      return false;
    }

    const winner = gameState.endResult;
    const ownerIndex = gameState.ownersByRegion?.[region.index];
    return ownerIndex === winner.slotIndex;
  }

  function canInteract(): boolean {
    if (effectivePreviewMode) return false;
    if (gameState?.endResult) return false;
    if (battleInProgress) return false;
    if (!gameState || gameState.movesRemaining <= 0) return false;
    if (!currentPlayer || currentPlayer.slotIndex !== gameState.currentPlayerSlot) return false;
    return true;
  }

  function handleRegionClick(region: Region): void {
    if (!canInteract()) return;
    onRegionClick(region);
  }

  function handleTempleClick(regionIndex: number): void {
    if (!canInteract()) return;
    onTempleClick(regionIndex);
  }
</script>

<div class="game-map" bind:this={mapContainerElement}>
  <svg class="map-svg" viewBox="0 0 800 600">
    <SvgDefinitions
      {gameState}
      {battlesInProgress}
    />

    <!-- Regions layer (bottom) -->
    <g filter="url(#regionShadow)">
    {#each regions as region (`${region.index}-${gameState?.ownersByRegion?.[region.index] ?? 'n'}`)}
      {@const gameHasEnded = !!(gameState?.endResult)}
      {@const isSelected = gameHasEnded ? false : (selectedRegion ? selectedRegion.index === region.index : false)}
      {@const isValidTarget = gameHasEnded ? false : validTargetRegions.includes(region.index)}
      {@const isMovable = gameHasEnded ? false : movableRegionIndices.has(region.index)}
      {@const isWinner = isWinnerRegion(region)}
      {@const hasMovesRemaining = !!(gameState && gameState.movesRemaining > 0)}
      {@const isMyTurn = !!(currentPlayer && gameState && currentPlayer.slotIndex === gameState.currentPlayerSlot)}
      {@const isClickable = !!(hasMovesRemaining && isMyTurn && !gameHasEnded)}
      {@const innerBorderOpacity = isWinner ? 0.85 : (isSelected ? 0.75 : (isValidTarget ? 0.65 : (isMovable ? 0.55 : 0)))}
      {@const soldierCount = gameState?.soldiersByRegion?.[region.index]?.length || 0}
      {@const canHighlightProp = isMovable || isWinner}
      {@const regionFillColor = regionColorMap[region.index] ?? '#c2b5a3'}
      <RegionRenderer
        {region}
        {gameState}
        {regions}
        isValidTarget={isValidTarget}
        isSelected={isSelected}
        isPreviewMode={effectivePreviewMode}
        canHighlight={isMovable || isWinner}
        isBattleInProgress={battlesInProgress.has(region.index)}
        fillColor={regionFillColor}
        borderColor={getBorderColor(region)}
        borderWidth={getBorderWidth(region)}
        innerBorderColor={isSelected || isMovable || isValidTarget || isWinner ? getInnerBorderColor(region, isSelected, isValidTarget, isWinner) : ''}
        innerBorderWidth={isWinner ? 14 : (isSelected ? 12 : 10)}
        innerBorderOpacity={innerBorderOpacity}
        isClickable={isClickable}
        onRegionClick={handleRegionClick}
        onTempleClick={handleTempleClick}
        renderArmies={false}
      />
    {/each}
    </g>

    <!-- Armies layer (top) - rendered above all regions -->
    <g class="armies-layer">
    {#each regions as region (region.index)}
      {@const soldierCount = gameState?.soldiersByRegion?.[region.index]?.length || 0}
      {@const hasTemple = gameState?.templesByRegion?.[region.index] !== undefined}
      {#if soldierCount > 0}
        <Army
          x={region.x}
          y={region.y}
          {hasTemple}
          {gameState}
          {regions}
          {region}
        />
      {/if}
    {/each}
    </g>

    <!-- Smoke layer (top-most) - rendered above everything -->
    <SmokeLayer />
  </svg>

  <!-- Tutorial Tooltips -->
  {#each tutorialTips as tooltip (tooltip.id)}
    <Tooltip
      id={tooltip.id}
      x={tooltip.x}
      y={tooltip.y}
      text={tooltip.text}
      width={tooltip.width || 7}
      onDismiss={onDismissTooltip}
    />
  {/each}
</div>

<style>
  .game-map {
    --map-ocean-color: #5b9fd8;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: var(--map-ocean-color);
    border-radius: 8px;
  }

  .map-svg {
    width: 100%;
    height: 100%;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .game-map {
      font-size: 0.8rem;
    }
  }
</style>
