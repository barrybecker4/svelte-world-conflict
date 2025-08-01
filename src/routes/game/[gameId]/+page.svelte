<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import WaitingRoom from '$lib/components/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';

  export let data;

  let gameState = 'loading'; // 'loading', 'waiting', 'playing', 'error'
  let game = null;
  let currentPlayer = null;
  let error = null;

  onMount(async () => {
    try {
      // Get player info from localStorage
      const gameId = $page.params.gameId;
      const playerData = localStorage.getItem(`wc_game_${gameId}`);

      if (!playerData) {
        error = 'Player data not found. Please rejoin the game.';
        gameState = 'error';
        return;
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
          error = `Game status: ${game.status}`;
          gameState = 'error';
        }
      } else {
        error = 'Failed to load game';
        gameState = 'error';
      }
    } catch (err) {
      error = 'Error loading game: ' + err.message;
      gameState = 'error';
    }
  });
</script>

{#if gameState === 'loading'}
  <div class="loading-container">
    <Spinner size="lg" color="teal" text="Loading game..." />
  </div>
{:else if gameState === 'waiting'}
  <WaitingRoom
    gameId={$page.params.gameId}
    currentPlayer={currentPlayer}
  />
{:else if gameState === 'playing'}
  <WorldConflictGame
    gameId={$page.params.gameId}
    initialGame={game}
    currentPlayer={currentPlayer}
  />
{:else if gameState === 'error'}
  <div class="error-container">
    <h2>Error</h2>
    <p>{error}</p>
    <Button variant="primary" on:click={() => window.location.href = '/'}>
      Return to Home
    </Button>
  </div>
{/if}

<style>
  .loading-container, .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #1a1a1a;F
    color: white;
  }
</style>