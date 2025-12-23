<script lang="ts">
import { Button, LoadingState, ConnectionStatus, AdBanner } from 'shared-ui';
  import { onMount, createEventDispatcher } from 'svelte';
        import PlayerSlotCard from './PlayerSlotCard.svelte';
  import GameSettingsDisplay from './GameSettingsDisplay.svelte';
  import { WaitingRoomManager } from './WaitingRoomManager';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import { loadGameCreator } from '$lib/client/stores/clientStorage';
  import { countOpenSlots, countActivePlayers, countTotalActiveSlots } from '$lib/client/slots/slotUtils';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
  import type { PendingGameData } from '$lib/game/entities/gameTypes';

  const dispatch = createEventDispatcher();

  export let gameId: string;
  export let initialGame: PendingGameData | null = null;

  let manager: WaitingRoomManager;
  let game: PendingGameData | null = null;
  let loading = true;
  let error: string | null = null;
  let wsConnected = false;
  let currentPlayerId: number | null = null;
  let isCreator = false;

  onMount(() => {
    const gameCreator = loadGameCreator(gameId);
    if (gameCreator) {
      currentPlayerId = gameCreator.playerSlotIndex;
    }

    manager = new WaitingRoomManager(gameId, currentPlayerId);
    manager.initialize(initialGame, () => {
      // Auto-start callback when game starts via WebSocket
      dispatch('gameStarted', { gameId });
    });

    const unsubGame = manager.game.subscribe(value => {
      game = value;
      checkIfCreator();
    });
    const unsubLoading = manager.loading.subscribe(value => loading = value);
    const unsubError = manager.error.subscribe(value => error = value);
    const unsubWsConnected = manager.wsConnected.subscribe(value => wsConnected = value);

    return () => {
      unsubGame();
      unsubLoading();
      unsubError();
      unsubWsConnected();
      manager?.destroy();
    };
  });

  function checkIfCreator() {
    const gameCreator = loadGameCreator(gameId);
    if (game && gameCreator && gameCreator.playerSlotIndex !== undefined) {
      isCreator = currentPlayerId === gameCreator.playerSlotIndex;
    }
  }

  function handleStartGame() {
    manager.startGame(() => {
      dispatch('gameStarted', { gameId });
    });
  }

  function handleLeaveGame() {
    manager.leaveGame(() => {
      dispatch('gameLeft');
    });
  }

  $: openSlotsCount = game ? countOpenSlots(game) : 0;
  $: activePlayersCount = game ? countActivePlayers(game) : 0;
  $: totalActiveSlots = game ? countTotalActiveSlots(game) : GAME_CONSTANTS.MAX_PLAYERS;

  // Ad configuration
  $: adUnitId = import.meta.env.VITE_ADSENSE_AD_UNIT_ID || '';
  $: showAds = adUnitId && !loading && game;
</script>

<div class="waiting-room-overlay">
  <div class="waiting-room-container" data-testid="waiting-room">
    <LoadingState {loading} loadingText="Loading game...">

      {#if error}
        <div class="error-message">
          ⚠️ {error}
        </div>
      {/if}

      <div class="header">
        <h1>
          🎮 Waiting Room
          <ConnectionStatus isConnected={wsConnected} />
        </h1>
        {#if game}
          <div class="game-info">
            <span class="game-id">Game: {gameId}</span>
            <span class="separator">•</span>
            <span class="player-status">
              {activePlayersCount}/{totalActiveSlots} players
            </span>
          </div>
        {/if}
      </div>

      {#if game}
        <div class="players-section">
          <h2>Players</h2>
          <div class="player-slots">
            {#each Array(4) as _, slotIndex}
              {@const slotInfo = manager.getSlotInfo(game, slotIndex, getPlayerConfig)}
              <PlayerSlotCard {slotIndex} {slotInfo} />
            {/each}
          </div>
        </div>

        <GameSettingsDisplay {game} />

        <div class="status-section">
          {#if openSlotsCount > 0}
            <p class="waiting-text">
              ⏳ Waiting for {openSlotsCount} player{openSlotsCount !== 1 ? 's' : ''} to join...
            </p>
            <p class="help-text">Share this game ID with friends: <strong>{gameId}</strong></p>
          {:else}
            <p class="waiting-text ready">
              🚀 Starting game...
            </p>
          {/if}

          <div class="action-buttons">
            {#if isCreator && openSlotsCount > 0}
              <Button
                variant="success"
                size="lg"
                on:click={handleStartGame}
                disabled={loading}
                data-testid="start-game-btn"
              >
                Start Anyway
              </Button>
            {/if}
            <Button
              variant="danger"
              size="lg"
              on:click={handleLeaveGame}
              disabled={loading}
              data-testid="leave-game-btn"
            >
              Leave Game
            </Button>
          </div>
        </div>
      {/if}
    </LoadingState>

    {#if showAds}
      <div class="ad-container">
        <AdBanner
          adUnitId={adUnitId}
          adFormat="rectangle"
          className="waiting-room-ad"
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .waiting-room-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(15, 23, 42, 0.95));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
  }

  .waiting-room-container {
    background: linear-gradient(145deg, #1e293b, #334155);
    border: 2px solid #475569;
    border-radius: 16px;
    padding: 2rem;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    color: white;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    text-align: center;
    color: #fecaca;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #475569;
  }

  .header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.8rem;
    font-weight: 700;
    background: linear-gradient(135deg, #60a5fa, #a855f7);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    position: relative;
  }

  .game-info {
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .separator {
    margin: 0 0.5rem;
    opacity: 0.5;
  }

  .players-section {
    margin-bottom: 2rem;
  }

  .players-section h2 {
    margin: 0 0 1rem 0;
    font-size: 1.3rem;
    color: #f1f5f9;
  }

  .player-slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .status-section {
    text-align: center;
  }

  .waiting-text {
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: #f1f5f9;
  }

  .waiting-text.ready {
    color: #10b981;
    font-weight: 600;
  }

  .help-text {
    font-size: 0.9rem;
    color: #94a3b8;
    margin-bottom: 1.5rem;
  }

  .help-text strong {
    color: #60a5fa;
    font-family: monospace;
    background: rgba(96, 165, 250, 0.1);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .waiting-room-container {
      width: 95%;
      padding: 1.5rem;
    }

    .player-slots {
      grid-template-columns: 1fr;
    }

    .action-buttons {
      flex-direction: column;
      align-items: center;
    }

    .action-buttons :global(button) {
      width: 100%;
      max-width: 200px;
    }
  }

  .ad-container {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(71, 85, 105, 0.3);
    display: flex;
    justify-content: center;
  }
</style>
