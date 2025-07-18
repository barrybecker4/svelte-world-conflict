<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';

  export let data;

  let gameId = $page.params.gameId;
  let playerInfo = null;
  let loading = true;
  let error = null;

  onMount(() => {
    // Get player info from localStorage
    const stored = localStorage.getItem(`wc_game_${gameId}`);
    if (stored) {
      try {
        playerInfo = JSON.parse(stored);
        loading = false;
      } catch (err) {
        error = 'Invalid player data stored';
        loading = false;
      }
    } else {
      error = 'No player data found - please join the game first';
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>World Conflict - Game {gameId}</title>
</svelte:head>

{#if loading}
  <div class="loading-screen">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <h2>Loading World Conflict...</h2>
      <p>Preparing your strategic campaign</p>
    </div>
  </div>
{:else if error}
  <div class="error-screen">
    <div class="error-content">
      <h2>Game Access Error</h2>
      <p>{error}</p>
      <a href="/" class="home-link">Return to Main Menu</a>
    </div>
  </div>
{:else if playerInfo}
  <WorldConflictGame
    {gameId}
    playerId={playerInfo.playerId}
    playerIndex={playerInfo.playerIndex}
  />
{:else}
  <div class="error-screen">
    <div class="error-content">
      <h2>Player Not Found</h2>
      <p>Unable to load your player information.</p>
      <a href="/" class="home-link">Return to Main Menu</a>
    </div>
  </div>
{/if}

<style>
  .loading-screen,
  .error-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
    font-family: system-ui, sans-serif;
  }

  .loading-content,
  .error-content {
    text-align: center;
    max-width: 400px;
    padding: 2rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #374151;
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .home-link {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .home-link:hover {
    background: linear-gradient(135deg, #1d4ed8, #1e40af);
    transform: translateY(-2px);
  }
</style>
