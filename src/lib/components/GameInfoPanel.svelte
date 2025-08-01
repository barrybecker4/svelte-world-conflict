<script lang="ts">
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';
  import Button from '$lib/components/ui/Button.svelte';
  import IconButton from '$lib/components/ui/IconButton.svelte';

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
    FAITH: '☧', // &#9775;
    DEAD: '☠', // &#9760;
    VICTORY: '♛', // &#9819;
    REGION: '★', // &#9733;
    MOVES: '➊' // &#10138;
  };

  // Original colors - using full hex values for better contrast
  const PLAYER_CONFIGS = [
    {
      name: 'Amber',
      colorStart: '#ffee88',  // More vivid than #fe8
      colorEnd: '#cc8811',
      highlightStart: '#ffdd88',
      highlightEnd: '#aa8800'
    },
    {
      name: 'Crimson',
      colorStart: '#ff8888',  // More vivid than #f88
      colorEnd: '#aa4444',
      highlightStart: '#ffaaaa',
      highlightEnd: '#994444'
    },
    {
      name: 'Lavender',
      colorStart: '#dd99dd',  // More vivid than #d9d
      colorEnd: '#883388',
      highlightStart: '#ffaaff',
      highlightEnd: '#775599'
    },
    {
      name: 'Emerald',
      colorStart: '#99dd99',  // More vivid than #9d9
      colorEnd: '#228822',
      highlightStart: '#bbffbb',
      highlightEnd: '#44aa44'
    }
  ];

  $: currentPlayerIndex = gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: turnNumber = gameState?.turnIndex ?? 1;
  $: maxTurns = gameState?.maxTurns;
  $: movesRemaining = gameState?.movesRemaining ?? 3;
  $: isMoving = moveMode !== 'IDLE';
  $: showCancelButton = isMoving && moveMode !== 'SELECT_SOURCE';

  function getPlayerColor(playerIndex: number) {
    const config = PLAYER_CONFIGS[playerIndex % PLAYER_CONFIGS.length];
    return config.colorStart;
  }

  function getPlayerHighlightColor(playerIndex: number) {
    const config = PLAYER_CONFIGS[playerIndex % PLAYER_CONFIGS.length];
    return config.highlightStart;
  }

  function getPlayerEndColor(playerIndex: number) {
    const config = PLAYER_CONFIGS[playerIndex % PLAYER_CONFIGS.length];
    return config.colorEnd;
  }

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

<div class="game-info-panel">
  <!-- Turn Information Section -->
  <div class="turn-section">
    <div class="turn-box">
      <div class="turn-header">Turn <span class="turn-number">{turnNumber}</span></div>
      {#if maxTurns}
        <div class="turn-progress">of {maxTurns}</div>
      {/if}
    </div>
  </div>

  <!-- Players Section -->
  <div class="players-section">
    {#each players as player, index}
      {@const isActive = index === currentPlayerIndex}
      {@const isAlive = isPlayerAlive(index)}
      {@const regionCount = getRegionCount(index)}
      {@const faithCount = getFaithCount(index)}

      <div class="player-box" class:active={isActive} class:inactive={!isActive}>
        <div
          class="player-color"
          style="background: linear-gradient(135deg, {getPlayerColor(index)}, {getPlayerEndColor(index)});"
        ></div>
        <div class="player-info">
          <div class="player-name">{player.name || PLAYER_CONFIGS[index].name}</div>
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
  </div>

  <!-- Instructions Section -->
  <div class="instructions-section">
    <div class="info-panel">
      <div class="instruction-text">
        {getCurrentInstruction()}
      </div>
    </div>
  </div>

  <!-- Player Stats Section -->
  <div class="player-stats-section">
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
  </div>

  <!-- Action Buttons Section -->
  <div class="action-section">
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
  </div>

  <!-- Bottom Action Icons -->
  <div class="bottom-actions">
    <IconButton title="Toggle Audio" on:click={onToggleAudio}>
      {#if audioEnabled}🔊{:else}🔇{/if}
    </IconButton>
    <IconButton title="Instructions" on:click={onShowInstructions}>❓</IconButton>
    <IconButton title="Resign" on:click={onResign}>🏳️</IconButton>
  </div>
</div>

<style>
  .game-info-panel {
    width: 280px;
    height: 100vh;
    background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%);
    color: white;
    display: flex;
    flex-direction: column;
    border-right: 2px solid #4a5568;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-y: auto;
  }

  /* Turn Section */
  .turn-section {
    flex: 0 0 auto;
    padding: 16px;
    border-bottom: 1px solid #4a5568;
  }

  .turn-box {
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1f2937;
    padding: 12px 16px;
    border-radius: 8px;
    text-align: center;
    font-weight: bold;
    border: 2px solid #d97706;
  }

  .turn-header {
    font-size: 1.1rem;
    margin-bottom: 2px;
  }

  .turn-number {
    font-size: 1.3rem;
    font-weight: 900;
  }

  .turn-progress {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  /* Players Section */
  .players-section {
    flex: 1 1 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-bottom: 1px solid #4a5568;
  }

  .player-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: 6px;
    border: 2px solid transparent;
    transition: all 0.2s ease;
  }

  .player-box.active {
    border-color: #60a5fa;
    background: rgba(96, 165, 250, 0.1);
    box-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
  }

  .player-box.inactive {
    background: rgba(0, 0, 0, 0.2);
  }

  .player-color {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid #374151;
    flex-shrink: 0;
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-weight: bold;
    font-size: 0.95rem;
    margin-bottom: 4px;
    color: #f7fafc;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
  }

  .player-stats {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    font-size: 0.85rem;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .stat .value {
    font-weight: bold;
    color: #f7fafc;
  }

  .stat .symbol {
    font-size: 0.8rem;
    opacity: 0.9;
  }

  .stat .symbol.dead {
    color: #ef4444;
    font-size: 1rem;
  }

  /* Instructions Section */
  .instructions-section {
    flex: 0 0 auto;
    padding: 16px;
    border-bottom: 1px solid #4a5568;
  }

  .info-panel {
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    border: 1px solid #333;
    min-height: 60px;
    display: flex;
    align-items: center;
  }

  .instruction-text {
    font-size: 0.9rem;
    line-height: 1.4;
    color: white;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
    white-space: pre-line;
  }

  /* Player Stats Section */
  .player-stats-section {
    flex: 0 0 auto;
    padding: 16px;
    border-bottom: 1px solid #4a5568;
  }

  .stat-display {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    border: 1px solid #4a5568;
    overflow: hidden;
  }

  .stat-item {
    flex: 1;
    padding: 10px;
    text-align: center;
    border-right: 1px solid #4a5568;
  }

  .stat-item:last-child {
    border-right: none;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 2px;
    color: #fbbf24;
  }

  .stat-value .symbol {
    font-size: 0.9rem;
    margin-left: 2px;
    opacity: 0.8;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #a0aec0;
    text-transform: lowercase;
  }

  /* Action Section */
  .action-section {
    flex: 0 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-bottom: 1px solid #4a5568;
  }

  /* Bottom Actions */
  .bottom-actions {
    flex: 0 0 auto;
    padding: 16px;
    display: flex;
    gap: 8px;
    justify-content: center;
  }
</style>
