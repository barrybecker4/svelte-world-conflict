<script lang="ts">
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { getPlayerConfig, getPlayerColor, getPlayerEndColor } from '$lib/game/constants/playerConfigs';

  export let gameState: WorldConflictGameStateData | null = null;
  export let players: Player[] = [];
  export let onEndTurn: () => void = () => {};
  export let onCancelMove: () => void = () => {};
  export let onUndo: () => void = () => {};
  export let onToggleAudio: () => void = () => {};
  export let onShowInstructions: () => void = () => {};
  export let onResign: () => void = () => {};
  export let moveMode: string = 'IDLE';
  export let selectedRegion: number | null = null;
  export let audioEnabled: boolean = true;

  // Unicode symbols matching original game
  const SYMBOLS = {
    FAITH: '☧',
    DEAD: '☠',
    VICTORY: '♛',
    REGION: '★',
    MOVES: '➊'
  };

  $: currentPlayerIndex = gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: turnNumber = gameState?.turnIndex ?? 1;
  $: maxTurns = gameState?.maxTurns;
  $: movesRemaining = gameState?.movesRemaining ?? 3;
  $: isMoving = moveMode !== 'IDLE';
  $: showCancelButton = isMoving && moveMode !== 'SELECT_SOURCE';

  function getRegionCount(playerIndex: number): number {
    if (!gameState?.owners) return 0;
    return Object.values(gameState.owners).filter(owner => owner === playerIndex).length;
  }

  function getFaithCount(playerIndex: number): number {
    return gameState?.cash?.[playerIndex] ?? 0;
  }

  function isPlayerAlive(playerIndex: number): boolean {
    return getRegionCount(playerIndex) > 0;
  }

  function getCurrentInstruction(): string {
    if (currentPlayer?.isAI) {
      return `${currentPlayer.name} is taking their turn.`;
    }

    switch (moveMode) {
      case 'SELECT_SOURCE':
        return 'Click on a region to move or attack with its army.';
      case 'ADJUST_SOLDIERS':
        return 'Click on this region again to choose how many to move.\nClick on a target region to move the army.';
      case 'SELECT_TARGET':
        return 'Click on a target region to move the army.';
      case 'BUILD':
        return 'Click on a temple to buy soldiers or upgrades.';
      default:
        return 'Click on a region to move or attack with its army.\nClick on a temple to buy soldiers or upgrades.';
    }
  }
</script>

<Panel variant="glass" padding={false} customClass="game-info-panel">

  <!-- Turn Section -->
  <Section title="" customClass="turn-section">
    <div class="turn-box">
      <div class="turn-header">Turn <span class="turn-number">{turnNumber}</span></div>
      {#if maxTurns}
        <div class="turn-progress">of {maxTurns}</div>
      {/if}
    </div>
  </Section>

  <!-- Players Section -->
  <Section title="" flex={true} flexDirection="column" gap="8px" customClass="flex-1">
    {#each players as player, index}
      {@const isActive = index === currentPlayerIndex}
      {@const isAlive = isPlayerAlive(index)}
      {@const regionCount = getRegionCount(index)}
      {@const faithCount = getFaithCount(index)}

      <div class="player-box" class:active={isActive}>
        <div
          class="player-color"
          style="background: linear-gradient(135deg, {getPlayerColor(index)}, {getPlayerEndColor(index)});"
        ></div>
        <div class="player-info">
          <div class="player-name">{player.name || getPlayerConfig(index).defaultName}</div>
          <div class="player-stats">
            <div class="stat">
              <span class="value">{regionCount}</span>
              <span class="symbol">{@html SYMBOLS.REGION}</span>
            </div>
            <div class="stat">
              <span class="value">{faithCount}</span>
              <span class="symbol">{@html SYMBOLS.FAITH}</span>
            </div>
            {#if !isAlive}
              <div class="stat">
                <span class="symbol dead">{@html SYMBOLS.DEAD}</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </Section>

  <Section title="">
    <div class="info-panel">
      <div class="instruction-text">
        {getCurrentInstruction()}
      </div>
    </div>
  </Section>

  <Section title="">
    <div class="stat-display">
      <div class="stat-item">
        <div class="stat-value">{movesRemaining} <span class="symbol">{@html SYMBOLS.MOVES}</span></div>
        <div class="stat-label">moves</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{getFaithCount(currentPlayerIndex)} <span class="symbol">{@html SYMBOLS.FAITH}</span></div>
        <div class="stat-label">faith</div>
      </div>
    </div>
  </Section>

  <Section title="" flex={true} flexDirection="column" gap="8px">
    {#if showCancelButton}
      <Button variant="danger" uppercase on:click={onCancelMove}>
        Cancel Move
      </Button>
    {:else}
      <Button variant="secondary" uppercase disabled={movesRemaining >= 3} on:click={onUndo}>
        Undo
      </Button>
    {/if}

    <Button variant="danger" size="lg" uppercase on:click={onEndTurn}>
      END TURN
    </Button>
  </Section>

  <!-- Bottom Actions -->
  <Section title="" borderBottom={false}>
    <div class="icon-actions">
      <IconButton title="Toggle Audio" on:click={onToggleAudio}>
        {#if audioEnabled}🔊{:else}🔇{/if}
      </IconButton>
      <IconButton title="Instructions" on:click={onShowInstructions}>❓</IconButton>
      <IconButton title="Resign" on:click={onResign}>🏳️</IconButton>
    </div>
  </Section>

</Panel>

<style>
  /* Main container uses Panel component, just override sizing */
  :global(.game-info-panel) {
    width: 280px;
    height: 100vh;
    border-right: 2px solid var(--border-light, #4a5568);
    font-family: system-ui, sans-serif;
    overflow-y: auto;
    flex-direction: column;
    display: flex;
  }

  /* Turn box - component-specific styling */
  .turn-section :global(.section-content) {
    display: flex;
    justify-content: center;
  }

  .turn-box {
    background: linear-gradient(135deg, var(--color-warning, #fbbf24), #f59e0b);
    color: var(--color-gray-900, #1f2937);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    border-radius: var(--radius-lg, 8px);
    text-align: center;
    font-weight: var(--font-bold, bold);
    border: 2px solid #d97706;
  }

  .turn-header {
    font-size: var(--text-lg, 1.1rem);
    margin-bottom: 2px;
  }

  .turn-number {
    font-size: var(--text-xl, 1.3rem);
    font-weight: var(--font-extrabold, 900);
  }

  .turn-progress {
    font-size: var(--text-sm, 0.85rem);
    opacity: 0.8;
  }

  /* Player cards */
  .player-box {
    background: var(--bg-panel-light, rgba(30, 41, 59, 0.6));
    border: 2px solid transparent;
    border-radius: var(--radius-md, 6px);
    padding: var(--space-3, 10px);
    transition: var(--transition-normal, all 0.2s ease);
    display: flex;
    align-items: center;
    gap: var(--space-3, 10px);
  }

  .player-box.active {
    border-color: var(--border-accent, #60a5fa);
    background: rgba(96, 165, 250, 0.1);
    box-shadow: var(--shadow-glow-accent, 0 0 8px rgba(96, 165, 250, 0.3));
  }

  .player-color {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
    border: 2px solid var(--border-medium, #374151);
    flex-shrink: 0;
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-weight: var(--font-bold, bold);
    font-size: var(--text-sm, 0.95rem);
    margin-bottom: 4px;
    color: var(--text-primary, #f7fafc);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
  }

  .player-stats {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: space-between;
    font-size: var(--text-sm, 0.85rem);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .stat .value {
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
  }

  .stat .symbol {
    font-size: var(--text-xs, 0.8rem);
    opacity: 0.9;
  }

  .stat .symbol.dead {
    color: var(--color-error, #ef4444);
    font-size: var(--text-base, 1rem);
  }

  /* Info panel */
  .info-panel {
    background: var(--bg-panel-light, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--border-dark, #333);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-3, 12px);
    min-height: 60px;
    display: flex;
    align-items: center;
  }

  .instruction-text {
    font-size: var(--text-sm, 0.9rem);
    line-height: 1.4;
    color: var(--text-primary, white);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
    white-space: pre-line;
  }

  /* Stats display */
  .stat-display {
    display: flex;
    background: var(--bg-panel-light, rgba(0, 0, 0, 0.3));
    border: 1px solid var(--border-light, #4a5568);
    border-radius: var(--radius-md, 6px);
    overflow: hidden;
  }

  .stat-item {
    flex: 1;
    padding: var(--space-3, 10px);
    text-align: center;
    border-right: 1px solid var(--border-light, #4a5568);
  }

  .stat-item:last-child {
    border-right: none;
  }

  .stat-value {
    font-size: var(--text-lg, 1.1rem);
    font-weight: var(--font-bold, bold);
    margin-bottom: 2px;
    color: var(--color-warning, #fbbf24);
  }

  .stat-value .symbol {
    font-size: var(--text-sm, 0.9rem);
    margin-left: 2px;
    opacity: 0.8;
  }

  .stat-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-tertiary, #a0aec0);
    text-transform: lowercase;
  }

  /* Icon actions */
  .icon-actions {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: center;
  }
</style>