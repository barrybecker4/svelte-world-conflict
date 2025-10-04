<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import GameSummaryHeader from './GameSummaryHeader.svelte';
  import PlayerSummaryRow from './PlayerSummaryRow.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { Player, GameStateData } from '$lib/game/state/GameState';
  import { PlayerStatisticsCalculator, type PlayerStats } from './PlayerStatisticsCalculator';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';

  export let gameState: GameStateData;
  export let players: Player[];
  export let isVisible: boolean = false;
  export let winner: Player | 'DRAWN_GAME' | null = null;

  const dispatch = createEventDispatcher();

  let statisticsCalculator: PlayerStatisticsCalculator;

  $: {
    if (gameState) {
      statisticsCalculator = new PlayerStatisticsCalculator(gameState);
    }
  }

  $: playerStats = statisticsCalculator ? statisticsCalculator.calculatePlayerStats(players) : [];
  $: gameEndReason = getGameEndReason();

  onMount(async () => {
    if (winner) {
      const currentPlayerSlot = gameState.currentPlayerSlot;

      if (winner !== 'DRAWN_GAME' && winner.slotIndex === currentPlayerSlot) {
        await audioSystem.playSound(SOUNDS.GAME_WON);
      } else {
        await audioSystem.playSound(SOUNDS.GAME_LOST);
      }
    }
  });

  function getPlayerColor(index: number): string {
    return getPlayerConfig(index).colorStart;
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
    const currentTurn = gameState.turnNumber + 1;

    if (maxTurns && currentTurn >= maxTurns) {
      return `Turn limit reached (${maxTurns} turns)`;
    }

    // Check if all but one player eliminated
    if (statisticsCalculator) {
      const activePlayers = statisticsCalculator.getActivePlayers(players);
      if (activePlayers.length <= 1) {
        return winner ? 'All other players eliminated' : 'All players eliminated';
      }
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

        <!-- Header Component -->
        <GameSummaryHeader {winner} {gameEndReason} />

        <!-- Player Rankings -->
        <div class="rankings">
          <h2>Final Rankings</h2>

          <div class="ranking-list">
            {#each playerStats as stat}
              {@const isWinner = stat.player === winner}
              {@const isEliminated = stat.regionCount === 0}

              <PlayerSummaryRow
                player={stat.player}
                rank={stat.rank}
                regionCount={stat.regionCount}
                soldierCount={stat.soldierCount}
                faithCount={stat.faithCount}
                totalScore={stat.totalScore}
                {isWinner}
                {isEliminated}
                playerColor={getPlayerColor(stat.player.slotIndex)}
                playerEndColor={getPlayerEndColor(stat.player.slotIndex)}
              />
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

  .rankings {
    margin-bottom: 2rem;
  }

  .rankings h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-gray-100, #f3f4f6);
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .ranking-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    .actions {
      flex-direction: column;
    }
  }
</style>