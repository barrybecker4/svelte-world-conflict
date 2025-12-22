<script lang="ts">
import { LoadingState, Button } from 'shared-ui';
import { onMount } from 'svelte';
import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import WaitingRoom from '$lib/components/waitingRoom/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
      import { loadGameCreator } from '$lib/client/stores/clientStorage';
  import { GameApiClient } from '$lib/client/gameController/GameApiClient';

  let gameState = 'loading'; // 'loading', 'waiting', 'playing', 'error'
  let game: any = null;
  let currentPlayer: any = null;
  let error: string | null = null;
  let loading = true;

  onMount(async () => {
    await loadGameData();
  });

  async function loadGameData() {
    try {
      loading = true;
      error = null;

    const gameId = $page.params.gameId as string;
      currentPlayer = loadGameCreator(gameId);

      if (!currentPlayer) {
        throw new Error('Player data not found. Please rejoin the game.');
      }

      // Load game state
      const apiClient = new GameApiClient(gameId);
      game = await apiClient.getGameState();

      if (game.status === 'PENDING') {
        gameState = 'waiting';
      } else if (game.status === 'ACTIVE') {
        gameState = 'playing';
      } else {
        throw new Error(`Unexpected game status: ${game.status}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      gameState = 'error';
    } finally {
      loading = false;
    }
  }

  function handleRetry() {
    loadGameData();
  }

  function handleReturnHome() {
    goto('/');
  }

  function handleGameStarted(event: CustomEvent) {
    // Refresh game data to get the latest state
    loadGameData();
  }

  function handleGameLeft() {
    goto('/');
  }
</script>

<LoadingState
  {loading}
  {error}
  loadingText="Loading game..."
  containerClass="fullscreen"
  showRetry={true}
  on:retry={handleRetry}
>
  <svelte:fragment slot="error-actions">
    <Button variant="primary" on:click={handleReturnHome}>
      Return to Home
    </Button>
  </svelte:fragment>

  {#if gameState === 'waiting'}
    <WaitingRoom
      gameId={$page.params.gameId as string}
      initialGame={game}
      on:gameStarted={handleGameStarted}
      on:gameLeft={handleGameLeft}
    />
  {:else if gameState === 'playing'}
    <WorldConflictGame
      gameId={$page.params.gameId as string}
      playerId={currentPlayer.playerId}
      playerSlotIndex={currentPlayer.playerSlotIndex}
    />
  {/if}
</LoadingState>
