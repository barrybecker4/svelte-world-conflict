<script lang="ts">
  import type { GameState } from '$lib/game/types';
  import type { Player } from '$lib/game/types';

  export let gameState: GameState | null = null;
  export let players: Player[] = [];
  export let currentPlayer: Player | null = null;

  function getPlayerStatus(player: Player): string {
    if (!gameState) return 'Unknown';

    const regionCount = Object.values(gameState.owners || {})
      .filter(owner => owner === player.index).length;

    if (regionCount === 0) return 'Eliminated';
    if (gameState.playerIndex === player.index) return 'Active Turn';
    return 'Waiting';
  }

  function getPlayerColor(playerIndex: number): string {
    const colors = ['#dc2626', '#2563eb', '#16a34a', '#ca8a04'];
    return colors[playerIndex % colors.length];
  }

  $: turnNumber = gameState?.turnIndex || 1;
  $: gamePhase = gameState?.status || 'SETUP';
</script>

<div class="game-status">
  <div class="turn-info">
    <h2>Turn {turnNumber}</h2>
    <div class="phase">Phase: {gamePhase}</div>
  </div>

  <div class="players-grid">
    {#each players as player, index}
      <div
        class="player-card"
        class:active={gameState?.playerIndex === player.index}
        style="border-color: {getPlayerColor(player.index)}"
      >
        <div class="player-header">
          <div
            class="player-indicator"
            style="background-color: {getPlayerColor(player.index)}"
          ></div>
          <span class="player-name">{player.name}</span>
        </div>

        <div class="player-stats">
          <div class="stat">
            <span class="stat-label">Regions:</span>
            <span class="stat-value">
              {Object.values(gameState?.owners || {}).filter(owner => owner === player.index).length}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Faith:</span>
            <span class="stat-value">{gameState?.cash?.[player.index] || 0}</span>
          </div>
        </div>

        <div class="player-status">
          {getPlayerStatus(player)}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .game-status {
    background: rgba(31, 41, 55, 0.9);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
    color: white;
  }

  .turn-info {
    text-align: center;
    margin-bottom: 1rem;
  }

  .turn-info h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .phase {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .player-card {
    background: rgba(0, 0, 0, 0.2);
    border: 2px solid transparent;
    border-radius: 0.5rem;
    padding: 1rem;
    transition: all 0.2s ease;
  }

  .player-card.active {
    border-color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .player-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .player-indicator {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
  }

  .player-name {
    font-weight: 600;
  }

  .player-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .stat-label {
    color: #9ca3af;
  }

  .stat-value {
    font-weight: 600;
  }

  .player-status {
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
    padding: 0.25rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 0.25rem;
  }

  .player-card.active .player-status {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  @media (max-width: 768px) {
    .players-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
