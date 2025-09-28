<script lang="ts">
  import type { Player } from '$lib/game/state/GameState';
  import { SYMBOLS } from '$lib/game/constants/symbols';

  export let player: Player;
  export let rank: number;
  export let regionCount: number;
  export let soldierCount: number;
  export let faithCount: number;
  export let totalScore: number;
  export let isWinner: boolean = false;
  export let isEliminated: boolean = false;
  export let playerColor: string;
  export let playerEndColor: string;
</script>

<div class="ranking-item" class:winner={isWinner} class:eliminated={isEliminated}>
  <div class="rank-number">
    {#if isWinner}
      {@html SYMBOLS.VICTORY}
    {:else}
      #{rank}
    {/if}
  </div>

  <div
    class="player-color-badge"
    style="background: linear-gradient(135deg, {playerColor}, {playerEndColor});"
  ></div>

  <div class="player-details">
    <div class="player-name">{player.name}</div>
    <div class="player-score">Score: {totalScore.toLocaleString()}</div>
  </div>

  <div class="player-stats">
    <div class="stat-item">
      <span class="stat-value">{regionCount}</span>
      <span class="stat-symbol">{@html SYMBOLS.REGION}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{soldierCount}</span>
      <span class="stat-symbol">{@html SYMBOLS.SOLDIER}</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{faithCount}</span>
      <span class="stat-symbol">{@html SYMBOLS.FAITH}</span>
    </div>
  </div>
</div>

<style>
  .ranking-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 8px;
    border: 2px solid var(--border-light, #374151);
    background: rgba(30, 41, 59, 0.4);
    transition: all 0.2s ease;
  }

  .ranking-item:hover {
    background: rgba(30, 41, 59, 0.6);
    border-color: var(--border-accent, #60a5fa);
  }

  .ranking-item.winner {
    border-color: var(--color-yellow-400, #facc15);
    background: rgba(251, 191, 36, 0.1);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
  }

  .ranking-item.eliminated {
    opacity: 0.6;
    background: rgba(15, 23, 42, 0.4);
  }

  .rank-number {
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--color-yellow-400, #facc15);
    min-width: 2.5rem;
    text-align: center;
  }

  .player-color-badge {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 2px solid var(--border-medium, #374151);
    flex-shrink: 0;
  }

  .player-details {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-gray-100, #f3f4f6);
    margin-bottom: 0.25rem;
  }

  .player-score {
    font-size: 0.9rem;
    color: var(--color-gray-400, #9ca3af);
  }

  .player-stats {
    display: flex;
    gap: 1rem;
    flex-shrink: 0;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.6);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border-light, #374151);
  }

  .stat-value {
    font-weight: 600;
    color: var(--color-gray-200, #e5e7eb);
    font-size: 0.9rem;
  }

  .stat-symbol {
    color: var(--color-gray-400, #9ca3af);
    font-size: 0.8rem;
  }

  @media (max-width: 640px) {
    .ranking-item {
      flex-direction: column;
      gap: 0.75rem;
      text-align: center;
    }

    .player-stats {
      justify-content: center;
    }
  }
</style>
