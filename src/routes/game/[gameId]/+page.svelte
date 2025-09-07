<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import WaitingRoom from '$lib/components/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { loadGameCreator } from '$lib/client/stores/clientStorage';

  let gameState = 'loading'; // 'loading', 'waiting', 'playing', 'error'
  let game = null;
  let currentPlayer = null;
  let error = null;
  let loading = true;

  onMount(async () => {
    await loadGameData();
  });

  async function loadGameData() {
    try {
      loading = true;
      error = null;

      const gameId = $page.params.gameId;
      currentPlayer = loadGameCreator(gameId);

      if (!currentPlayer) {
        throw new Error('Player data not found. Please rejoin the game.');
      }

      // Load game state
      const response = await fetch(`/api/game/${gameId}`);
      if (response.ok) {
        game = await response.json();

        if (game.status === 'PENDING') {
          gameState = 'waiting';
        } else if (game.status === 'ACTIVE') {
          gameState = 'playing';
        } else {
          throw new Error(`Unexpected game status: ${game.status}`);
        }
      } else {
        throw new Error('Failed to load game');
      }
    } catch (err) {
      console.error('❌ Error loading game:', err);
      error = err.message;
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

  function handleGameStarted(event) {
    console.log('🚀 Game started event received:', event.detail);
    // Refresh game data to get the latest state
    loadGameData();
  }

  function handleGameLeft() {
    console.log('🚪 Player left game');
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
      gameId={$page.params.gameId}
      initialGame={game}
      on:gameStarted={handleGameStarted}
      on:gameLeft={handleGameLeft}
    />
  {:else if gameState === 'playing'}
    <WorldConflictGame
      gameId={$page.params.gameId}
      playerId={currentPlayer.playerId}
      playerIndex={currentPlayer.playerIndex}
    />
  {/if}
</LoadingState>
