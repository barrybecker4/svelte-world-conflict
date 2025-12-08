<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import ConnectionStatus from '$lib/components/ui/ConnectionStatus.svelte';
  import PlayerNameInput from '$lib/components/configuration/PlayerNameInput.svelte';
  import OpenGameRow from './OpenGameRow.svelte';
  import HistoricalStatsModal from '$lib/components/modals/HistoricalStatsModal.svelte';
  import { OpenGamesManager, type OpenGame } from './OpenGamesManager';
  import { loadPlayerName, savePlayerName } from '$lib/client/stores/clientStorage';
  import { logger } from '$lib/game/utils/logger';

  const dispatch = createEventDispatcher();

  let gamesManager: OpenGamesManager;
  let shouldRender = true;
  let games: OpenGame[] = [];
  let loading = true;
  let error: string | null = null;
  let wsConnected = false;
  let showNameInput = true;
  let playerName = '';
  let showStats = false;

  let unsubGames: () => void;
  let unsubLoading: () => void;
  let unsubError: () => void;
  let unsubWsConnected: () => void;

  onMount(() => {
    logger.debug('Lobby component mounted');
    
    // Check if player has a name saved
    const storedName = loadPlayerName();
    if (storedName) {
      playerName = storedName;
      showNameInput = false;
      initializeGamesManager();
    }
    // Otherwise, wait for name input before initializing games manager
  });

  function initializeGamesManager() {
    gamesManager = new OpenGamesManager();
    gamesManager.initialize();

    unsubGames = gamesManager.games.subscribe(value => games = value);
    unsubLoading = gamesManager.loading.subscribe(value => {
      loading = value;
      // Don't auto-close when no games - let users stay in lobby to wait for games
      // or click "New Game" to create one
    });
    unsubError = gamesManager.error.subscribe(value => error = value);
    unsubWsConnected = gamesManager.wsConnected.subscribe(value => wsConnected = value);
  }

  function handleNameSubmitted(event: CustomEvent) {
    const { name } = event.detail;
    playerName = name;
    savePlayerName(name);
    showNameInput = false;
    initializeGamesManager();
  }

  onDestroy(() => {
    logger.debug('Lobby component being destroyed, cleaning up...');
    unsubGames?.();
    unsubLoading?.();
    unsubError?.();
    unsubWsConnected?.();
    gamesManager?.destroy();
  });

  function close() {
    dispatch('close');
  }

  function handleRetry() {
    gamesManager?.loadOpenGames();
  }
</script>

{#if shouldRender}
<div class="lobby-overlay">
  {#if showNameInput}
    <div class="name-input-container">
      <PlayerNameInput
        initialName={playerName}
        on:nameSubmitted={handleNameSubmitted}
      />
    </div>
  {:else}
    <div class="lobby-container">
      <div class="lobby-header">
        <h1>Select Game
          <br />
          <span class="title-subheader">
            Click on an open player slot to join a game
            <ConnectionStatus isConnected={wsConnected} />
          </span>
        </h1>
      </div>

      <div class="lobby-content">
        {#if error}
          <div class="error-message">
            ⚠️ {error}
          </div>
        {/if}

        <LoadingState
          {loading}
          loadingText="Loading available games..."
          showRetry={true}
          on:retry={handleRetry}
        >
          {#if games.length > 0}
            <div class="games-list">
              <h3>Available Games ({games.length})</h3>
              {#each games as game (game.gameId)}
                <OpenGameRow {game} {gamesManager} />
              {/each}
            </div>
          {:else}
            <div class="no-games-message">
              <p class="no-games-title">🎮 No games available</p>
              <p class="no-games-subtitle">Waiting for open games... Create one to get started!</p>
            </div>
          {/if}
        </LoadingState>

        <div class="stats-button-container">
          <Button variant="ghost" size="sm" on:click={() => showStats = true}>
            📊 Historical Statistics
          </Button>
        </div>
      </div>

      <div class="bottom-box">
        <Button variant="primary" size="lg" on:click={close} data-testid="new-game-btn">
          New Game
        </Button>
        <Button variant="ghost" size="lg" on:click={close} data-testid="lobby-back-btn">
          Back
        </Button>
      </div>
    </div>
  {/if}
</div>
{/if}

<HistoricalStatsModal bind:isOpen={showStats} />

<style>
  .lobby-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--color-gray-800, #1e293b) 0%, var(--color-gray-700, #334155) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 1000);
    color: var(--text-primary, white);
    font-family: system-ui, sans-serif;
  }

  .lobby-container {
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .name-input-container {
    max-width: 400px;
    width: 90%;
    padding: 2rem;
  }

  .lobby-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .lobby-header h1 {
    font-size: 3rem;
    font-weight: bold;
    background: linear-gradient(135deg, var(--color-primary-400, #60a5fa), #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }

  .title-subheader {
    font-size: 1.2rem;
    color: var(--text-tertiary, #94a3b8);
    font-weight: normal;
    position: relative;
  }

  .lobby-content {
    background: var(--bg-panel-glass, rgba(31, 41, 55, 0.9));
    border: 2px solid var(--border-light, #475569);
    border-radius: 12px;
    padding: 2rem;
    min-height: 300px;
    max-height: 500px;
    overflow-y: auto;
    backdrop-filter: blur(10px);
    flex: 1;
  }

  .error-message {
    background: var(--bg-error, rgba(239, 68, 68, 0.2));
    border: 1px solid var(--color-error, #ef4444);
    border-radius: var(--radius-lg, 8px);
    padding: 1rem;
    margin-bottom: 1rem;
    text-align: center;
    color: #fecaca;
  }

  .games-list h3 {
    margin-bottom: 1.5rem;
    color: var(--text-primary, #f8fafc);
    font-size: 1.3rem;
  }

  .no-games-message {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--text-secondary, #cbd5e1);
  }

  .no-games-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: var(--text-primary, #f8fafc);
  }

  .no-games-subtitle {
    font-size: 1rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .stats-button-container {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
  }

  .bottom-box {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 2rem 0 0;
  }

  @media (max-width: 640px) {
    .lobby-container {
      width: 95%;
      max-height: 90vh;
    }

    .lobby-header h1 {
      font-size: 2rem;
    }

    .title-subheader {
      font-size: 1rem;
    }
  }
</style>