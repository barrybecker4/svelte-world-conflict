<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import type { WorldConflictGameStateData, Player } from '$lib/game/WorldConflictGameState.ts';

  // Simple interface for page data (SvelteKit generates $types automatically)
  interface PageData {
    gameId?: string;
    game?: any;
    player?: any;
  }

  // Interface for the World Conflict game API response
  interface WorldConflictGameResponse {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    players: Player[];
    worldConflictState: WorldConflictGameStateData;
    createdAt: number;
    lastMoveAt: number;
    currentPlayerIndex: number;
    gameType: 'MULTIPLAYER' | 'AI';
  }

  // Type guard to validate game data structure
  function isWorldConflictGameResponse(data: any): data is WorldConflictGameResponse {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.gameId === 'string' &&
      typeof data.status === 'string' &&
      Array.isArray(data.players) &&
      data.worldConflictState &&
      typeof data.worldConflictState === 'object' &&
      typeof data.createdAt === 'number' &&
      typeof data.lastMoveAt === 'number' &&
      typeof data.currentPlayerIndex === 'number' &&
      data.gameType &&
      (data.gameType === 'MULTIPLAYER' || data.gameType === 'AI')
    );
  }

  // const export since it's unused for external reference only
  export const data: PageData = {};

  let gameId: string = $page.params.gameId || '';
  let playerId: string = '';
  let playerIndex: number = -1;
  let loading: boolean = true;
  let error: string | null = null;

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }

  // Load player info from localStorage and validate game access
  function loadPlayerInfo(): boolean {
    try {
      const stored = localStorage.getItem(`wc_game_${gameId}`);
      if (!stored) {
        error = 'No player information found for this game';
        return false;
      }

      const playerInfo = JSON.parse(stored);
      if (playerInfo.playerIndex === undefined) {
        error = 'Invalid player information stored';
        return false;
      }

      // For World Conflict, playerId is the string version of playerIndex
      playerId = playerInfo.playerId || playerInfo.playerIndex.toString();
      playerIndex = playerInfo.playerIndex;
      return true;
    } catch (err) {
      console.error('🔍 DEBUG - Error loading player info:', err);
      error = 'Failed to load player information';
      return false;
    }
  }

  // Load game data when component mounts
  async function loadGameData(): Promise<void> {
    try {
      loading = true;
      error = null;

      // First, load player info from localStorage
      if (!loadPlayerInfo()) {
        setTimeout(() => goto('/'), 2000); // Redirect to lobby if no valid player info
        return;
      }

      const gameData = getGameData(gameId);
      console.log('✅ Game data loaded successfully:', gameData.gameId);

    } catch (err) {
      error = getErrorMessage(err);
      console.error('Failed to load game:', err);
    } finally {
      loading = false;
    }
  }

  async function getGameData(gameId: string): Promise<WorldConflictGameResponse> {
    const response = await fetch(`/api/game/${gameId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Game not found');
      }
      throw new Error(`Failed to load game: ${response.status}`);
    }

    const gameData =  await response.json();
    if (!isWorldConflictGameResponse(gameData)) {
      throw new Error('Invalid game data received from server - not a valid World Conflict game');
    }

    return gameData;
  }

  // Load data when component mounts
  onMount(() => {
    loadGameData();
  });
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
      <div class="space-y-3">
        <button
          on:click={loadGameData}
          class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        <button
          on:click={() => goto('/')}
          class="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  </div>
{:else if playerId && playerIndex !== -1}
  <WorldConflictGame
    {gameId}
    {playerId}
    {playerIndex}
  />
{:else}
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-gray-600">No valid player data available</p>
  </div>
{/if}

<style>
  .loading-screen, .error-screen {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
</style>
