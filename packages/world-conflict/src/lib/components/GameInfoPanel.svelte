<script lang="ts">
  import type { GameStateData, Player } from '$lib/game/state/GameState';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import TurnTimer from '$lib/components/TurnTimer.svelte';
  import { getPlayerConfig, getPlayerColor, getPlayerEndColor } from '$lib/game/constants/playerConfigs';
  import AudioButton from '$lib/components/configuration/AudioButton.svelte';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
  import { SYMBOLS } from '$lib/game/constants/symbols';

  export let gameState: GameStateData | null = null;
  export let players: Player[] = [];
  export let onEndTurn: () => void = () => {};
  export let onCancelMove: () => void = () => {};
  export let onUndo: () => void = () => {};
  export let onShowInstructions: () => void = () => {};
  export let onResign: () => void = () => {};
  export let moveMode: string = 'IDLE';
  export let playerSlotIndex: number;
  export let canUndo: boolean = false;

  // Reactive statements - these will update whenever gameState changes
  $: currentPlayerSlot = gameState?.currentPlayerSlot ?? 0;
  $: currentPlayer = players.find(p => p.slotIndex === currentPlayerSlot);
  $: isMyTurn = currentPlayerSlot === playerSlotIndex;
  $: currentPlayerDarkColor = currentPlayer ? getPlayerEndColor(currentPlayer.slotIndex) : '';

  $: turnNumber = (gameState?.turnNumber ?? 0) + 1;
  $: maxTurns = gameState?.maxTurns && gameState.maxTurns !== GAME_CONSTANTS.UNLIMITED_TURNS ? gameState.maxTurns : null;
  $: movesRemaining = gameState?.movesRemaining ?? 3;
  $: isMoving = moveMode !== 'IDLE';
  $: showCancelButton = isMoving && moveMode !== 'SELECT_SOURCE';
  $: turnLimitExceeded = maxTurns !== null && turnNumber > maxTurns;
  $: isGameOver = (gameState?.endResult !== null && gameState?.endResult !== undefined) || turnLimitExceeded;

  // Make faith counts reactive to gameState changes
  $: faithByPlayer = gameState?.faithByPlayer ?? {};

  function getRegionCount(slotIndex: number): number {
      if (!gameState?.ownersByRegion) return 0;
      return Object.values(gameState.ownersByRegion).filter(owner => owner === slotIndex).length;
  }

  function isPlayerAlive(slotIndex: number): boolean {
      return getRegionCount(slotIndex) > 0;
  }

  // Reactive instruction text based on game state and move mode
  $: instructionText = (() => {
    if (!isMyTurn && currentPlayer) {
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
  })();
</script>

<Panel variant="glass" padding={false} customClass="game-info-panel">

  <!-- Turn Section -->
  <Section title="" customClass="turn-section">
    <div class="turn-box">
      <div class="turn-header">
        {#if isGameOver}
          Game over
        {:else}
          Turn <span class="turn-number" data-testid="turn-number">{turnNumber}</span>{#if maxTurns} &nbsp;/ {maxTurns}{/if}
        {/if}
      </div>
    </div>
  </Section>

  <!-- Players Section -->
  <Section title="" flex={true} flexDirection="column" gap="8px" customClass="flex-1">
    {#each players.slice().sort((a, b) => a.slotIndex - b.slotIndex) as player, slotOrderIndex}
      {@const isActive = player.slotIndex === currentPlayerSlot}
      {@const isAlive = isPlayerAlive(player.slotIndex)}
      {@const regionCount = getRegionCount(player.slotIndex)}
      {@const faithCount = faithByPlayer[player.slotIndex]}

      <div class="player-box" class:active={isActive} data-testid="player-info-{player.name}">
        <div class="player-color" style="background: {player.color};"></div>
        <div class="player-info">
          <div class="player-name" data-testid="{isActive ? 'current-turn-player' : ''}">{player.name}</div>
          <div class="player-stats">
            <div class="stat">
              <span class="value" data-testid="player-territories">{regionCount}</span>
              <span class="symbol">{@html SYMBOLS.REGION}</span>
            </div>
            <div class="stat">
              <span class="value" data-testid="player-units">{faithCount}</span>
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
    <div
      class="info-panel"
      style={!isMyTurn && currentPlayerDarkColor ? `background-color: ${currentPlayerDarkColor};` : ''}
    >
      <div class="instruction-text" data-testid="current-phase">
        {instructionText}
      </div>
    </div>
  </Section>

  <TurnTimer />

  <Section title="">
    <div class="stat-display">
      <div class="stat-item">
        <div class="stat-value">{movesRemaining} <span class="symbol">{@html SYMBOLS.MOVES}</span></div>
        <div class="stat-label">moves</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{faithByPlayer[currentPlayerSlot]} <span class="symbol">{@html SYMBOLS.FAITH}</span></div>
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
      <Button variant="secondary" uppercase disabled={!canUndo || !isMyTurn} on:click={onUndo}>
        ↩️ Undo
      </Button>
    {/if}

    <Button variant="danger" size="lg" uppercase on:click={onEndTurn} data-testid="end-turn-btn">
      END TURN
    </Button>
  </Section>

  <!-- Bottom Actions -->
  <Section title="" borderBottom={false}>
    <div class="icon-actions">
      <AudioButton/>
      <IconButton title="Instructions" on:click={onShowInstructions}>❓</IconButton>
      <IconButton title="Resign" on:click={onResign}>🏳️</IconButton>
    </div>

  </Section>

</Panel>

<style>
  /* Main container */
  :global(.game-info-panel) {
    width: 280px;
    height: 100vh;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
    border: 1px solid var(--border-light, #374151);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Turn section */
  :global(.turn-section) {
    background: transparent;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .turn-box {
    text-align: left;
    padding: var(--space-3, 12px);
    background: rgba(30, 30, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-sm, 4px);
  }

  .turn-header {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
  }

  .turn-number {
    color: var(--text-primary, #f7fafc);
    font-weight: var(--font-bold, bold);
  }

  /* Player boxes */
  .player-box {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px);
    border-radius: var(--radius-md, 6px);
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid transparent;
    transition: all 0.2s ease;
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
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
    font-size: var(--text-sm, 0.875rem);
    margin-bottom: 4px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
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
    color: var(--text-primary, #f7fafc);
    font-weight: var(--font-semibold, 600);
  }

  .stat .symbol {
    opacity: 0.8;
    font-size: 0.9em;
  }

  .stat .symbol.dead {
    color: var(--color-danger, #ef4444);
  }

  /* Instructions */
  .info-panel {
    background: rgba(15, 23, 42, 0.4);
    border-radius: var(--radius-md, 6px);
    padding: var(--space-3, 12px);
  }

  .instruction-text {
    color: var(--text-secondary, #cbd5e1);
    font-size: var(--text-sm, 0.9rem);
    line-height: 1.4;
    white-space: pre-line;
    font-weight: var(--font-semibold, 600);
  }

  /* White text when showing player turn message */
  .info-panel[style*="background-color"] .instruction-text {
    color: #ffffff;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
  }

  /* Current player stats */
  .stat-display {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
  }

  .stat-item {
    text-align: center;
    padding: var(--space-2, 8px);
    background: rgba(15, 23, 42, 0.4);
    border-radius: var(--radius-sm, 4px);
  }

  .stat-value {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
    margin-bottom: 2px;
  }

  .stat-value .symbol {
    font-size: 0.8em;
    opacity: 0.7;
    margin-left: 2px;
  }

  .stat-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-secondary, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Icon actions */
  .icon-actions {
    display: flex;
    justify-content: center;
    gap: var(--space-2, 8px);
  }

  /* Flex section override */
  :global(.flex-1) {
    flex: 1;
    overflow-y: auto;
  }
</style>
