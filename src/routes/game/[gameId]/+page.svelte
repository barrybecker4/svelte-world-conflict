<script lang="ts">
  import { page } from '$app/stores';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';

  // Simple interface for page data (SvelteKit generates $types automatically)
  interface PageData {
    gameId?: string;
    game?: any;
    player?: any;
  }

  // Accept data prop from load function (even if unused)
  export let data: PageData = {};

  // Properly typed variables
  let gameId: string = $page.params.gameId || '';
  let playerInfo: any = null; // You can replace 'any' with proper player type
  let loading: boolean = true;
  let error: string | null = null;

  // Helper function for safe error handling
  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  // Load game data when component mounts
  async function loadGameData(): Promise<void> {
    try {
      loading = true;
      error = null;

      const response = await fetch(`/api/game/${gameId}`);

      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.status}`);
      }

      const gameData = await response.json();
      playerInfo = gameData;

    } catch (err) {
      error = getErrorMessage(err);
      console.error('Failed to load game:', err);
    } finally {
      loading = false;
    }
  }

  // Load data when component mounts
  loadGameData();
</script>

<svelte:head>
  <title>World Conflict - Game {gameId}</title>
</svelte:head>

{#if loading}
  <div class="loading-screen flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p class="text-gray-600">Loading game...</p>
    </div>
  </div>
{:else if error}
  <div class="error-screen flex items-center justify-center min-h-screen">
    <div class="text-center max-w-md">
      <h2 class="text-2xl font-bold text-red-600 mb-4">Error Loading Game</h2>
      <p class="text-gray-700 mb-6">{error}</p>
      <button
        on:click={loadGameData}
        class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
{:else if playerInfo}
  <WorldConflictGame
    gameId={gameId}
    playerInfo={playerInfo}
  />
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-gray-600">No game data available</p>
  </div>
{/if}

<style>
  .loading-screen, .error-screen {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>
