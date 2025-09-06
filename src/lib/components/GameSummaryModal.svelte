<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { Player, GameStateData } from '$lib/game/classes/GameState';

  export let gameState: GameStateData;
  export let players: Player[];
  export let isVisible: boolean = false;
  export let winner: Player | 'DRAWN_GAME' | null = null;

  const dispatch = createEventDispatcher();

  // Symbols for UI
  const SYMBOLS = {
    FAITH: '&#9775;',
    REGION: '&#9733;',
    SOLDIER: '&#9813;',
    VICTORY: '&#9819;',
    CROWN: '&#128081;'
  };

  interface PlayerStats {
    player: Player;
    regionCount: number;
    soldierCount: number;
    faithCount: number;
    totalScore: number;
    rank: number;
  }

  $: playerStats = calculatePlayerStats();
  $: gameEndReason = getGameEndReason();

  function calculatePlayerStats(): PlayerStats[] {
    if (!gameState || !players.length) return [];

    const stats = players.map(player => {
      const regionCount = getRegionCount(player.index);
      const soldierCount = getTotalSoldiers(player.index);
      const faithCount = gameState.faithByPlayer[player.index] || 0;

      // Calculate total score (same as game logic: 1000 * regions + soldiers)
      const totalScore = (1000 * regionCount) + soldierCount;

      return {
        player,
        regionCount,
        soldierCount,
        faithCount,
        totalScore,
        rank: 0 // Will be calculated after sorting
      };
    });

    // Sort by score descending and assign ranks
    stats.sort((a, b) => b.totalScore - a.totalScore);
    stats.forEach((stat, index) => {
      stat.rank = index + 1;
    });

    return stats;
  }

  function getRegionCount(playerIndex: number): number {
    if (!gameState?.ownersByRegion) return 0;
    return Object.values(gameState.ownersByRegion).filter(owner => owner === playerIndex).length;
  }

  function getTotalSoldiers(playerIndex: number): number {
    if (!gameState?.soldiersByRegion) return 0;

    let total = 0;
    Object.entries(gameState.soldiersByRegion).forEach(([regionIndexStr, soldiers]) => {
      const regionIndex = parseInt(regionIndexStr);
      if (gameState.ownersByRegion[regionIndex] === playerIndex) {
        total += soldiers.length;
      }
    });

    return total;
  }

  function getPlayerColor(index: number): string {
    return getPlayerConfig(index).color;
  }

  function getPlayerEndColor(index: number): string {
    return getPlayerConfig(index).colorEnd;
  }

  function getGameEndReason(): string {
    if (winner === 'DRAWN_GAME') {
      return 'Game ended in a draw!';
    }

    // Check if game ended due to turn limit
    const maxTurns = gameState.maxTurns;
    const currentTurn = gameState.turnIndex + 1;

    if (maxTurns && currentTurn >= maxTurns) {
      return `Turn limit reached (${maxTurns} turns)`;
    }

    // Check if all but one player eliminated
    const activePlayers = playerStats.filter(stat => stat.regionCount > 0);
    if (activePlayers.length <= 1) {
      return winner ? 'All other players eliminated' : 'All players eliminated';
    }

    return 'Game completed';
  }

  function handlePlayAgain() {
    dispatch('playAgain');
  }
</script>

{#if isVisible}
  <div class="modal-overlay" on:click={handlePlayAgain}>
    <div class="modal-content" on:click|stopPropagation>
      <Panel variant="primary" padding={true} customClass="summary-panel">

        <!-- Header -->
        <div class="summary-header">
          {#if winner === 'DRAWN_GAME'}
            <h1 class="title draw">Game Draw!</h1>
            <p class="subtitle">The game ended in a tie</p>
          {:else if winner}
            <h1 class="title victory">{@html SYMBOLS.CROWN} {winner.name} Wins! {@html SYMBOLS.CROWN}</h1>
            <p class="subtitle">Congratulations!</p>
          {:else}
            <h1 class="title">Game Over</h1>
            <p class="subtitle">Final Results</p>
          {/if}

          <div class="game-info">
            <span class="end-reason">{gameEndReason}</span>
          </div>
        </div>

        <!-- Player Rankings -->
        <div class="rankings">
          <h2>Final Rankings</h2>

          <div class="ranking-list">
            {#each playerStats as stat, index}
              {@const isWinner = stat.player === winner}
              {@const isEliminated = stat.regionCount === 0}

              <div class="ranking-item" class:winner={isWinner} class:eliminated={isEliminated}>
                <div class="rank-number">
                  {#if isWinner && winner !== 'DRAWN_GAME'}
                    {@html SYMBOLS.VICTORY}
                  {:else}
                    #{stat.rank}
                  {/if}
                </div>

                <div
                  class="player-color-badge"
                  style="background: linear-gradient(135deg, {getPlayerColor(stat.player.index)}, {getPlayerEndColor(stat.player.index)});"
                ></div>

                <div class="player-details">
                  <div class="player-name">{stat.player.name}</div>
                  <div class="player-score">Score: {stat.totalScore.toLocaleString()}</div>
                </div>

                <div class="player-stats">
                  <div class="stat-item">
                    <span class="stat-value">{stat.regionCount}</span>
                    <span class="stat-symbol">{@html SYMBOLS.REGION}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{stat.soldierCount}</span>
                    <span class="stat-symbol">{@html SYMBOLS.SOLDIER}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">{stat.faithCount}</span>
                    <span class="stat-symbol">{@html SYMBOLS.FAITH}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="actions">
          <Button
            variant="primary"
            size="lg"
            on:click={handlePlayAgain}
          >
            Play Again
          </Button>
        </div>

      </Panel>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    max-width: 600px;
    max-height: 80vh;
    width: 90%;
    overflow-y: auto;
  }

  :global(.summary-panel) {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
    border: 2px solid var(--border-accent, #60a5fa);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .summary-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--border-light, #374151);
  }

  .title {
    font-size: 2.5rem;
    font-weight: 900;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  }

  .title.victory {
    color: var(--color-yellow-400, #facc15);
    animation: glow 2s ease-in-out infinite alternate;
  }

  .title.draw {
    color: var(--color-blue-400, #60a5fa);
  }

  @keyframes glow {
    from {
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5), 0 0 10px rgba(250, 204, 21, 0.5);
    }
    to {
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5), 0 0 20px rgba(250, 204, 21, 0.8);
    }
  }

  .subtitle {
    font-size: 1.2rem;
    color: var(--color-gray-300, #d1d5db);
    margin-bottom: 1rem;
  }

  .game-info {
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .end-reason {
    background: rgba(96, 165, 250, 0.1);
    color: var(--color-blue-300, #93c5fd);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    border: 1px solid var(--border-accent, #60a5fa);
  }

  .rankings h2 {
    color: var(--color-gray-100, #f3f4f6);
    font-size: 1.5rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .ranking-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ranking-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(30, 41, 59, 0.4);
    border: 2px solid transparent;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .ranking-item.winner {
    border-color: var(--color-yellow-400, #facc15);
    background: rgba(250, 204, 21, 0.1);
    box-shadow: 0 0 15px rgba(250, 204, 21, 0.3);
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

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 2px solid var(--border-light, #374151);
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

    .actions {
      flex-direction: column;
    }

    .title {
      font-size: 2rem;
    }
  }
</style>
