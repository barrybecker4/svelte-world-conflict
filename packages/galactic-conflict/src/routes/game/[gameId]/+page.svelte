<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import GalacticConflictGame from '$lib/components/GalacticConflictGame.svelte';
  import WaitingRoom from '$lib/components/waitingRoom/WaitingRoom.svelte';
  import { goto } from '$app/navigation';
  import type { GalacticGameStateData, PendingGameData } from '$lib/game/entities/gameTypes';

  let gameId: string;
  let gameState: GalacticGameStateData | null = null;
  let pendingGame: PendingGameData | null = null;
  let loading = true;
  let error: string | null = null;

  $: gameId = $page.params.gameId;

  onMount(async () => {
    await loadGame();
  });

  async function loadGame() {
    loading = true;
    error = null;

    try {
      const response = await fetch(`/api/game/${gameId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'PENDING') {
        pendingGame = data;
        gameState = null;
      } else if (data.status === 'ACTIVE' || data.status === 'COMPLETED') {
        gameState = data.gameState;
        pendingGame = null;
      } else {
        throw new Error(`Unknown game status: ${data.status}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load game';
      console.error('Error loading game:', err);
    } finally {
      loading = false;
    }
  }

  function handleGameStarted() {
    loadGame();
  }

  function handleGameLeft() {
    goto('/');
  }
</script>

<svelte:head>
  <title>Galactic Conflict - Game {gameId}</title>
</svelte:head>

{#if loading}
  <div class="loading-container">
    <div class="loading-spinner"></div>
    <p>Loading galaxy...</p>
  </div>
{:else if error}
  <div class="error-container">
    <h2>Error</h2>
    <p>{error}</p>
    <button class="game-button game-button-primary" on:click={() => goto('/')}>
      Return Home
    </button>
  </div>
{:else if pendingGame}
  <WaitingRoom
    {gameId}
    initialGame={pendingGame}
    on:gameStarted={handleGameStarted}
    on:gameLeft={handleGameLeft}
  />
{:else if gameState}
  <GalacticConflictGame {gameId} initialState={gameState} />
{:else}
  <div class="error-container">
    <h2>Game Not Found</h2>
    <p>The requested game could not be found.</p>
    <button class="game-button game-button-primary" on:click={() => goto('/')}>
      Return Home
    </button>
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #a78bfa;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #4c1d95;
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #f87171;
    text-align: center;
    padding: 2rem;
  }

  .error-container h2 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .error-container p {
    margin-bottom: 2rem;
    color: #fca5a5;
  }
</style>

