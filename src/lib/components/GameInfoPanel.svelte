<!-- GameInfoPanel.svelte - Complete left panel matching original design -->
<script lang="ts">
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState';

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

  // Original pastel player colors from the GAS code
  const PLAYER_CONFIGS = [
    {
      name: 'Amber',
      colorStart: '#fe8',
      colorEnd: '#c81',
      highlightStart: '#fd8',
      highlightEnd: '#a80'
    },
    {
      name: 'Crimson',
      colorStart: '#f88',
      colorEnd: '#a44',
      highlightStart: '#faa',
      highlightEnd: '#944'
    },
    {
      name: 'Lavender',
      colorStart: '#d9d',
      colorEnd: '#838',
      highlightStart: '#faf',
      highlightEnd: '#759'
    },
    {
      name: 'Emerald',
      colorStart: '#9d9',
      colorEnd: '#282',
      highlightStart: '#bfb',
      highlightEnd: '#4a4'
    }
  ];

  $: currentPlayerIndex = gameState?.playerIndex ?? 0;
  $: currentPlayer = players[currentPlayerIndex];
  $: turnNumber = gameState?.turnIndex ?? 1;
  $: maxTurns = gameState?.maxTurns; // Assuming this exists in gameState
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

  function isPlayerWinner(playerIndex: number): boolean {
    return gameState?.endResult === playerIndex;
  }

  function getInstructionText(): string {
    if (currentPlayer?.isAI) {
      return `${currentPlayer.name} is taking their turn.`;
    }

    if (moveMode === 'BUILD') {
      return 'Choose an upgrade to build.';
    } else if (moveMode === 'MOVING_ARMY') {
      return 'Click on this region again to choose how many to move.\nClick on a target region to move the army.';
    } else if (moveMode === 'SELECT_SOURCE') {
      return 'Click on a region to move or attack with its army.';
    } else {
      return `Click on a region to move or attack with its army.\nClick on a temple to buy soldiers or upgrades with ${SYMBOLS.FAITH}.`;
    }
  }
</script>

<div class="game-info-panel">
  <!-- Turn Information Section -->
  <section class="turn-section">
    <div class="turn-display">
      {#if maxTurns}
        Turn <strong>{turnNumber}</strong> / {maxTurns}
      {:else}
        Turn <strong>{turnNumber}</strong>
      {/if}
    </div>
  </section>

  <!-- Players Section -->
  <section class="players-section">
    {#each players as player, index}
      {@const isActive = index === currentPlayerIndex}
      {@const regionCount = getRegionCount(index)}
      {@const faithCount = getFaithCount(index)}
      {@const isAlive = isPlayerAlive(index)}
      {@const isWinner = isPlayerWinner(index)}
      {@const playerColor = getPlayerColor(index)}
      {@const highlightColor = getPlayerHighlightColor(index)}

      <div
        class="player-box"
        class:active={isActive}
        class:highlighted={isActive}
        style="background: {playerColor}; {isActive ? `box-shadow: 0 0 0 3px ${highlightColor};` : ''}"
      >
        <div class="player-name">{player.name}</div>
        <div class="player-stats">
          <div class="stat faith-stat">
            {#if gameState?.endResult}
              {#if isWinner}
                <span class="symbol">{SYMBOLS.VICTORY}</span>
              {/if}
            {:else if isAlive}
              <span class="value">{faithCount}</span><span class="symbol">{SYMBOLS.FAITH}</span>
            {/if}
          </div>
          <div class="stat region-stat">
            {#if isAlive}
              <span class="value">{regionCount}</span><span class="symbol">{SYMBOLS.REGION}</span>
            {:else}
              <span class="symbol dead">{SYMBOLS.DEAD}</span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </section>

  <!-- Instructions Section -->
  <section class="instructions-section">
    <div
      class="info-panel"
      style="background: {currentPlayer ? getPlayerEndColor(currentPlayerIndex) : '#666'}"
    >
      <div class="instruction-text">
        {getInstructionText()}
      </div>
    </div>
  </section>

  <!-- Current Player Stats -->
  <section class="player-stats-section">
    <div class="stat-display">
      <div class="stat-item">
        <div class="stat-value">
          <span class="value">{movesRemaining}</span>
          <span class="symbol">{SYMBOLS.MOVES}</span>
        </div>
        <div class="stat-label">moves</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">
          <span class="value">{currentPlayer ? getFaithCount(currentPlayerIndex) : 0}</span>
          <span class="symbol">{SYMBOLS.FAITH}</span>
        </div>
        <div class="stat-label">faith</div>
      </div>
    </div>
  </section>

  <!-- Action Buttons -->
  <section class="action-section">
    {#if showCancelButton}
      <button class="action-btn cancel-btn" on:click={onCancelMove}>
        Cancel Move
      </button>
    {/if}
    <button
      class="action-btn end-turn-btn"
      on:click={onEndTurn}
      disabled={currentPlayer?.isAI}
    >
      End Turn
    </button>
  </section>

  <!-- Bottom Action Icons -->
  <section class="bottom-icons">
    <button class="icon-btn" on:click={onUndo} title="Undo">
      ↶
    </button>
    <button
      class="icon-btn"
      on:click={onToggleAudio}
      title="Toggle Audio"
      class:active={audioEnabled}
    >
      {audioEnabled ? '🔊' : '🔇'}
    </button>
    <button class="icon-btn" on:click={onShowInstructions} title="Instructions">
      ❓
    </button>
    <button class="icon-btn resign-btn" on:click={onResign} title="Resign">
      🏳️
    </button>
  </section>
</div>

<style>
  .game-info-panel {
    width: 280px;
    height: 100vh;
    background: linear-gradient(to bottom, #2d3748, #1a202c);
    color: white;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-right: 2px solid #4a5568;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
  }

  /* Turn Section */
  .turn-section {
    text-align: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid #4a5568;
  }

  .turn-display {
    font-size: 1.1rem;
    color: #e2e8f0;
  }

  .turn-display strong {
    color: #fbbf24;
    font-weight: bold;
  }

  /* Players Section */
  .players-section {
    flex: 0 0 auto;
  }

  .player-box {
    margin-bottom: 4px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #333;
    transition: all 0.2s ease;
    position: relative;
  }

  .player-box.highlighted {
    border: 2px solid #fbbf24;
    transform: scale(1.02);
  }

  .player-box.active {
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3); }
    50% { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.6); }
  }

  .player-name {
    font-weight: bold;
    font-size: 0.95rem;
    margin-bottom: 4px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .player-stats {
    display: flex;
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
  }

  .info-panel {
    padding: 12px;
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
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-btn {
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: #f59e0b;
    color: #1f2937;
  }

  .cancel-btn:hover:not(:disabled) {
    background: #d97706;
    transform: translateY(-1px);
  }

  .end-turn-btn {
    background: #dc2626;
    color: white;
  }

  .end-turn-btn:hover:not(:disabled) {
    background: #b91c1c;
    transform: translateY(-1px);
  }

  /* Bottom Icons */
  .bottom-icons {
    flex: 1;
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    padding: 1rem 0;
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    color: #a0aec0;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #4a5568;
  }

  .icon-btn:hover {
    background: rgba(0, 0, 0, 0.6);
    color: white;
    transform: translateY(-2px);
  }

  .icon-btn.active {
    background: #10b981;
    color: white;
  }

  .icon-btn.resign-btn:hover {
    background: #dc2626;
    color: white;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .game-info-panel {
      width: 100%;
      height: auto;
      max-height: 300px;
      flex-direction: row;
      overflow-x: auto;
      border-right: none;
      border-bottom: 2px solid #4a5568;
    }

    .players-section {
      display: flex;
      gap: 8px;
      flex-wrap: nowrap;
    }

    .player-box {
      min-width: 120px;
      flex-shrink: 0;
    }

    .bottom-icons {
      display: none;
    }
  }
</style>
