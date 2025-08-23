<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import WaitingRoom from '$lib/components/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let gameState = 'loading'; // 'loading', 'waiting', 'playing', 'error'
  let game = null;
  let currentPlayer = null;
  let error = null;
  let loading = true;

  $: if (gameState) {
    console.log('🎮 Parent - Game state updated:', {
      turnIndex: gameState.turnIndex,
      currentPlayer: gameState.playerIndex,
      faithByPlayer: gameState.faithByPlayer,
      beforeAfterComparison: JSON.stringify(gameState.faithByPlayer)
    });
  }

  onMount(async () => {
    await loadGameData();
  });

  async function loadGameData() {
    try {
      loading = true;
      error = null;

      // Get player info from localStorage
      const gameId = $page.params.gameId;
      const playerData = localStorage.getItem(`wc_game_${gameId}`);

      if (!playerData) {
        throw new Error('Player data not found. Please rejoin the game.');
      }

      currentPlayer = JSON.parse(playerData);

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
    window.location.href = '/';
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
      currentPlayer={currentPlayer}
    />
  {:else if gameState === 'playing'}
    <WorldConflictGame
      gameId={$page.params.gameId}
      playerId={currentPlayer.playerId}
      playerIndex={currentPlayer.playerIndex}
    />
  {/if}
</LoadingState>