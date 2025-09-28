<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { Player, GameStateData } from '$lib/game/state/GameState';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';
  import { SYMBOLS } from '$lib/game/constants/symbols';

  export let gameState: GameStateData;
  export let players: Player[];
  export let isVisible: boolean = false;
  export let winner: Player | 'DRAWN_GAME' | null = null;

  const dispatch = createEventDispatcher();

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

  onMount(async () => {
    if (winner) {
        const localPlayer = gameState.getLocalPlayer();

        if (winner.slotIndex === localPlayer.slotIndex) {
            await audioSystem.playSound(SOUNDS.GAME_WON);
        } else {
            await audioSystem.playSound(SOUNDS.GAME_LOST);
        }
    }
  });

  function calculatePlayerStats(): PlayerStats[] {
    if (!gameState || !players.length) return [];

    const stats = players.map(player => {
      const regionCount = getRegionCount(player.slotIndex);
      const soldierCount = getTotalSoldiers(player.slotIndex);
      const faithCount = gameState.faithByPlayer[player.slotIndex] || 0;

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

  function getRegionCount(slotIndex: number): number {
    if (!gameState?.ownersByRegion) return 0;
    return Object.values(gameState.ownersByRegion).filter(owner => owner === slotIndex).length;
  }

  function getTotalSoldiers(slotIndex: number): number {
    if (!gameState?.soldiersByRegion) return 0;
    return Object.entries(gameState.soldiersByRegion)
      .filter(([regionIdx, soldiers]) => gameState.ownersByRegion[regionIdx] === slotIndex)
      .reduce((total, [_, soldiers]) => total + soldiers.length, 0);
  }

  function getGameEndReason(): string {
    if (winner === 'DRAWN_GAME') {
      return 'Game ended in a draw';
    }

    if (winner) {
      // Check if all other players eliminated
      const alivePlayers = players.filter(p => getRegionCount(p.slotIndex) > 0);
      if (alivePlayers.length === 1) {
        return `${winner.name} conquered all regions!`;
      }

      // Otherwise it was turn limit
      return `${winner.name} had the most regions when time ran out!`;
    }

    return 'Game completed';
  }

  function handlePlayAgain() {
    dispatch('playAgain');
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if isVisible}
  <div class="modal-overlay" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <Panel variant="glass" padding="lg" customClass="summary-panel">

        <div class="summary-header">
          <h1 class="title">
            {#if winner === 'DRAWN_GAME'}
              Game Draw!
            {:else if winner}
              {winner.name} Wins! {@html SYMBOLS.VICTORY}
            {:else}
              Game Complete
            {/if}
          </h1>
          <p class="subtitle">{gameEndReason}</p>
        </div>

        <div class="results-section">
          <h2 class="section-title">Final Standings</h2>

          <div class="player-rankings">
            {#each playerStats as stat, index}
              <div class="ranking-item" class:winner={stat.player === winner}>
                <div class="rank-badge">
                  {#if stat.rank === 1}
                    {@html SYMBOLS.VICTORY}
                  {:else}
                    {stat.rank}
                  {/if}
                </div>

                <div class="player-info">
                  <div class="player-name" style="color: {stat.player.color};">
                    {stat.player.name}
                  </div>
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
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1500;
    backdrop-filter: blur(1px);
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
    font-size: var(--text-3xl, 1.875rem);
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  }

  .subtitle {
    font-size: var(--text-lg, 1.125rem);
    color: var(--text-secondary, #cbd5e1);
    font-style: italic;
  }

  .results-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
    margin-bottom: 1rem;
    text-align: center;
  }

  .player-rankings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
  }

  .ranking-item {
    display: flex;
    align-items: center;
    gap: var(--space-4, 16px);
    padding: var(--space-4, 16px);
    background: rgba(15, 23, 42, 0.6);
    border-radius: var(--radius-lg, 8px);
    border: 1px solid var(--border-light, #374151);
    transition: all 0.2s ease;
  }

  .ranking-item.winner {
    background: rgba(34, 197, 94, 0.1);
    border-color: var(--color-success, #22c55e);
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
  }

  .rank-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-primary, #3b82f6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-bold, bold);
    font-size: var(--text-lg, 1.125rem);
    flex-shrink: 0;
  }

  .ranking-item.winner .rank-badge {
    background: var(--color-success, #22c55e);
  }

  .player-info {
    flex: 1;
    min-width: 0;
  }

  .player-name {
    font-size: var(--text-lg, 1.125rem);
    font-weight: var(--font-semibold, 600);
    margin-bottom: 2px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .player-score {
    font-size: var(--text-sm, 0.875rem);
    color: var(--text-secondary, #94a3b8);
  }

  .player-stats {
    display: flex;
    gap: var(--space-4, 16px);
    align-items: center;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(15, 23, 42, 0.8);
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--border-light, #374151);
  }

  .stat-value {
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f7fafc);
    font-size: var(--text-sm, 0.875rem);
  }

  .stat-symbol {
    font-size: 0.8em;
    opacity: 0.8;
  }

  .actions {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid var(--border-light, #374151);
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .ranking-item {
      flex-direction: column;
      gap: var(--space-2, 8px);
      text-align: center;
    }

    .player-stats {
      justify-content: center;
      gap: var(--space-2, 8px);
    }

    .title {
      font-size: var(--text-2xl, 1.5rem);
    }

    .subtitle {
      font-size: var(--text-base, 1rem);
    }
  }
</style>
