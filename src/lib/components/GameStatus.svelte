<script lang="ts">
  import type { GameStateData, Player } from '$lib/game/WorldConflictGameState';
  import { getPlayerColor } from '$lib/game/constants/playerColors';

  export let gameState: GameStateData | null = null;
  export let players: Player[] = [];
  export const currentPlayer: Player | null = null; // Changed to const export since it's unused

  function getPlayerStatus(player: Player): string {
    if (!gameState) return 'Unknown';

    const regionCount = Object.values(gameState.ownersByRegions || {})
      .filter(owner => owner === player.index).length;

    if (regionCount === 0) return 'Eliminated';
    if (gameState.playerIndex === player.index) return 'Active Turn';
    return 'Waiting';
  }

  $: turnNumber = gameState?.turnIndex || 1;
</script>

<div class="game-status">
  <div class="turn-info">
    <h2>Turn {turnNumber}</h2>
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
              {Object.values(gameState?.ownersByRegion || {}).filter(owner => owner === player.index).length}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Faith:</span>
            <span class="stat-value">{gameState?.cashByPlayer?.[player.index] || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Status:</span>
            <span class="stat-value">{getPlayerStatus(player)}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .game-status {
    padding: 1rem;
    background: rgba(15, 23, 42, 0.8);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .turn-info {
    text-align: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #475569;
  }

  .turn-info h2 {
    margin: 0 0 0.5rem 0;
    color: #f8fafc;
    font-size: 1.5rem;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .player-card {
    background: rgba(30, 41, 59, 0.6);
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .player-card.active {
    background: rgba(30, 41, 59, 0.9);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  }

  .player-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .player-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .player-name {
    font-weight: 600;
    color: #f8fafc;
    font-size: 1rem;
  }

  .player-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat-label {
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .stat-value {
    color: #f8fafc;
    font-weight: 600;
    font-size: 0.9rem;
  }
</style>
