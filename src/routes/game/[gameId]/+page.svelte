<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import WaitingRoom from '$lib/components/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import Button from '$lib/components/buttons/Button.svelte';

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
    <div class="loading-spinner"></div>
    <p>Loading game...</p>
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
    background: #1a1a1a;
    color: white;
  }

  .loading-spinner {
    border: 4px solid #333;
    border-left: 4px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>