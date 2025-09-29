<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import type { OpenGamesManager, GameSlotInfo } from './OpenGamesManager';

  export let game: any;
  export let gamesManager: OpenGamesManager;

  function handleSlotClick(slotIndex: number, slotInfo: GameSlotInfo) {
    if (slotInfo.canJoin) {
      gamesManager.joinGameInSlot(game.gameId, slotIndex);
    }
  }
</script>

<div class="game-card">
  <div class="game-header">
    <div class="game-title">
      {game.creator}'s Game
    </div>
    <div class="game-details">
      <span class="player-count">
        {game.playerCount}/{game.maxPlayers} players
      </span>
      <span class="separator">•</span>
      <span class="game-age">
        {gamesManager.formatTimeAgo(game.createdAt)}
      </span>
    </div>
  </div>
F
  <div class="player-slots">
    {#each Array(4) as _, slotIndex}
      {@const slotInfo = gamesManager.getSlotInfo(game, slotIndex)}
      <div class="player-slot">
        <div class="slot-label">Player {slotIndex + 1}</div>
        <Button
          variant={gamesManager.getSlotButtonVariant(slotInfo)}
          size="sm"
          disabled={!slotInfo.canJoin}
          on:click={() => handleSlotClick(slotIndex, slotInfo)}
          class="slot-button {slotInfo.type}"
        >
          {slotInfo.name}
        </Button>
      </div>
    {/each}
  </div>
</div>

<style>
  .game-card {
    background: var(--bg-panel-light, rgba(30, 41, 59, 0.8));
    border: 1px solid var(--border-light, #475569);
    border-radius: var(--radius-lg, 8px);
    padding: 1.5rem;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .game-card:hover {
    border-color: var(--color-primary-400, #60a5fa);
    background: var(--bg-panel-light, rgba(30, 41, 59, 0.95));
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .game-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
  }

  .game-details {
    font-size: 0.9rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .separator {
    margin: 0 0.5rem;
    opacity: 0.5;
  }

  .player-slots {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .player-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .slot-label {
    font-size: 0.8rem;
    color: var(--text-tertiary, #94a3b8);
    font-weight: 500;
  }

  :global(.slot-button) {
    min-width: 120px;
    transition: all 0.2s;
  }

  :global(.slot-button.open:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  :global(.slot-button.creator) {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  }

  :global(.slot-button.taken) {
    opacity: 0.7;
  }

  :global(.slot-button.ai) {
    opacity: 0.6;
    font-style: italic;
  }

  :global(.slot-button.disabled) {
    opacity: 0.4;
  }

  @media (max-width: 640px) {
    .player-slots {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .game-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    :global(.slot-button) {
      min-width: 100px;
    }
  }
</style>
