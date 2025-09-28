<script lang="ts">
  import type { Player } from '$lib/game/state/GameState';

  export let winner: Player | 'DRAWN_GAME' | null = null;
  export let gameEndReason: string;

  const SYMBOLS = {
    CROWN: '&#128081;'
  };
</script>

<div class="summary-header">
  {#if winner === 'DRAWN_GAME'}
    <h1 class="title draw">Game Draw!</h1>
    <p class="subtitle">The game ended in a tie</p>
  {:else if winner}
    <h1 class="title victory">{@html SYMBOLS.CROWN} {winner.name} Wins!</h1>
    <p class="subtitle">Congratulations!</p>
  {:else}
    <h1 class="title">Game Over</h1>
    <p class="subtitle">Final Results</p>
  {/if}

  <div class="game-info">
    <span class="end-reason">{gameEndReason}</span>
  </div>
</div>

<style>
  .summary-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--border-light, #374151);
  }

  .title {
    font-size: 3rem;
    font-weight: 900;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #60a5fa, #3b82f6);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: none;
  }

  .title.victory {
    background: linear-gradient(135deg, #facc15, #f59e0b);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .title.draw {
    background: linear-gradient(135deg, #94a3b8, #64748b);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--color-gray-300, #d1d5db);
    margin: 0 0 1rem 0;
    font-weight: 500;
  }

  .game-info {
    margin-top: 1rem;
  }

  .end-reason {
    font-size: 0.9rem;
    color: var(--color-gray-400, #9ca3af);
    background: rgba(15, 23, 42, 0.6);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    border: 1px solid var(--border-light, #374151);
    display: inline-block;
  }

  @media (max-width: 640px) {
    .title {
      font-size: 2rem;
    }
  }
</style>