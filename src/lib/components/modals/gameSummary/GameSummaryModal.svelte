<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import GameSummaryHeader from './GameSummaryHeader.svelte';
  import PlayerSummaryRow from './PlayerSummaryRow.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import type { Player, GameStateData } from '$lib/game/state/GameState';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';

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

      if (winner !== 'DRAWN_GAME' && winner.slotIndex === localPlayer.slotIndex) {
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

  function getRegionCount(playerSlotIndex: number): number {
    if (!gameState?.ownersByRegion) return 0;
    return Object.values(gameState.ownersByRegion).filter(owner => owner === playerSlotIndex).length;
  }

  function getTotalSoldiers(playerSlotIndex: number): number {
    if (!gameState?.soldiersByRegion) return 0;

    let total = 0;
    Object.entries(gameState.soldiersByRegion).forEach(([regionIndexStr, soldiers]) => {
      const regionIndex = parseInt(regionIndexStr);
      if (gameState.ownersByRegion[regionIndex] === playerSlotIndex) {
        total += soldiers.length;
      }
    });

    return total;
  }

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

        <!-- Actions -->
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