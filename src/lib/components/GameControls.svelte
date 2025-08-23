<script lang="ts">
  import type { WorldConflictGameState, Player } from '$lib/game/WorldConflictGameState';
  import Button from '$lib/components/ui/Button.svelte';

  export let gameState: WorldConflictGameState | null = null;
  export let currentPlayer: Player | null = null;
  export let onEndTurn: () => void = () => {};
  export let onBuyArmies: () => void = () => {};
  export let onUpgradeTemple: () => void = () => {};
  export let canEndTurn: boolean = false;
  export let movesRemaining: number = 0;

  $: playerFaith = gameState?.faithByPlayer?.[currentPlayer?.index || 0] || 0;
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
    <Button
      variant="primary"
      disabled={!isPlayerTurn || playerFaith < 10}
      on:click={onBuyArmies}
    >
      Buy Armies (10 Faith)
    </Button>

    <Button
      variant="secondary"
      disabled={!isPlayerTurn || playerFaith < 50}
      on:click={onUpgradeTemple}
    >
      Upgrade Temple (50 Faith)
    </Button>

    <Button
      variant="success"
      disabled={!canEndTurn || !isPlayerTurn}
      on:click={onEndTurn}
    >
      End Turn
    </Button>
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

  @media (max-width: 768px) {
    .action-buttons {
      flex-direction: column;
    }

    .action-buttons :global(.btn-base) {
      width: 100%;
    }
  }
</style>
