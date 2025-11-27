<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import WaitingRoom from '$lib/components/waitingRoom/WaitingRoom.svelte';
  import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import SoundTestModal from '$lib/components/modals/SoundTestModal.svelte';
  import { loadGameCreator } from '$lib/client/stores/clientStorage';

  let gameState = 'loading'; // 'loading', 'waiting', 'playing', 'error'
  let game: any = null;
  let currentPlayer: any = null;
  let error: string | null = null;
  let loading = true;
  let showSoundTestModal = false;

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

  function openSoundTestModal() {
    showSoundTestModal = true;
  }

  function closeSoundTestModal() {
    showSoundTestModal = false;
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
      playerSlotIndex={currentPlayer.playerSlotIndex}
    />
  {/if}
  {#if import.meta.env.DEV}
    <button
      on:click={openSoundTestModal}
      style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: orange; color: white; padding: 8px; border: none; border-radius: 4px;"
    >
      🎵 Test Sounds
    </button>
  {/if}
</LoadingState>

{#if showSoundTestModal}
  <SoundTestModal isOpen={showSoundTestModal} onclose={closeSoundTestModal} />
{/if}
