<script lang="ts">
  import type { WorldConflictGameState, Player } from '$lib/game/WorldConflictGameState';

  export let gameState: WorldConflictGameState | null = null;
  export let currentPlayer: Player | null = null;
  export let onEndTurn: () => void = () => {};
  export let onBuyArmies: () => void = () => {};
  export let onUpgradeTemple: () => void = () => {};
  export let canEndTurn: boolean = false;
  export let movesRemaining: number = 0;

  $: playerFaith = gameState?.cash?.[currentPlayer?.index || 0] || 0;
  $: isPlayerTurn = gameState?.playerIndex === currentPlayer?.index;
</script>

<div class="game-controls">
  <div class="player-info">
    <h3>Current Player: {currentPlayer?.name || 'Unknown'}</h3>
    <div class="stats">
      <span class="stat">Faith: {playerFaith}</span>
      <span class="stat">Moves: {movesRemaining}</span>
    </div>
  </div>

  <div class="action-buttons">
    <button
      class="btn btn-primary"
      on:click={onBuyArmies}
      disabled={!isPlayerTurn || playerFaith < 10}
    >
      Buy Armies (10 Faith)
    </button>

    <button
      class="btn btn-secondary"
      on:click={onUpgradeTemple}
      disabled={!isPlayerTurn || playerFaith < 50}
    >
      Upgrade Temple (50 Faith)
    </button>

    <button
      class="btn btn-success"
      on:click={onEndTurn}
      disabled={!canEndTurn || !isPlayerTurn}
    >
      End Turn
    </button>
  </div>
</div>

<style>
  .game-controls {
    background: rgba(31, 41, 55, 0.9);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
  }

  .player-info h3 {
    margin: 0 0 0.5rem 0;
    color: white;
  }

  .stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    background: rgba(59, 130, 246, 0.2);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    color: white;
    font-size: 0.875rem;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #2563eb;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .btn-secondary {
    background: #7c3aed;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #6d28d9;
  }

  .btn-success {
    background: #16a34a;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #15803d;
  }

  @media (max-width: 768px) {
    .action-buttons {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>
