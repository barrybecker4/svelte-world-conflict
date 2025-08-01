<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { getPlayerColor } from '$lib/game/constants/playerConfigs';

  export let gameId;
  export let currentPlayer; // The current user's player info

  let game = null;
  let loading = true;
  let error = null;
  let isCreator = false;
  let pollInterval;

  onMount(() => {
    loadGameState();
    // Poll for updates every 2 seconds
    pollInterval = setInterval(loadGameState, 2000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  async function loadGameState() {
    try {
      const response = await fetch(`/api/game/${gameId}`);
      if (response.ok) {
        game = await response.json();
        isCreator = game.players.length > 0 &&
                   game.players[0].index === currentPlayer.playerIndex;

        // If game has started, redirect to game page
        if (game.status === 'ACTIVE') {
          goto(`/game/${gameId}`);
        }
      } else {
        error = 'Failed to load game state';
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
    } finally {
      loading = false;
    }
  }

  async function startGame() {
    try {
      const response = await fetch(`/api/game/${gameId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentPlayer.playerIndex.toString()
        })
      });

      if (response.ok) {
        // Game will start, page will redirect via loadGameState polling
        loading = true;
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to start game';
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
      setTimeout(() => error = null, 3000);
    }
  }

  async function leaveGame() {
    // Implement leave game logic here
    goto('/');
  }

  function getSlotDisplay(index) {
    if (game && index < game.players.length) {
      const player = game.players[index];
      return {
        name: player.name,
        type: player.isAI ? 'AI' : 'Set',
        color: getPlayerColor(index)
      };
    }
    return {
      name: '< open >',
      type: 'Open',
      color: getPlayerColor(index)
    };
  }
</script>

<div class="waiting-room-overlay">
  <div class="waiting-room-container">
    <div class="header">
      <h1>Player {currentPlayer.playerName} Setup</h1>
    </div>

    {#if loading}
      <div class="loading">
        <Spinner size="lg" color="teal" text="Loading game..." />
      </div>
    {:else if error}
      <div class="error-message">
        ⚠️ {error}
      </div>
    {:else}
      <div class="game-setup">
        <!-- Player Slots -->
        <div class="player-slots">
          {#each Array(4) as _, index}
            {@const slot = getSlotDisplay(index)}
            <div class="player-slot" style="background-color: {slot.color}">
              <div class="player-name">{slot.name}</div>
              <div class="player-controls">
                <button class="slot-button {slot.type === 'Open' ? 'active' : ''}" disabled>
                  Off
                </button>
                <button class="slot-button {slot.type === 'Set' ? 'active' : ''}" disabled>
                  Set
                </button>
                <button class="slot-button {slot.type === 'Open' ? 'active' : ''}" disabled>
                  Open
                </button>
                <button class="slot-button {slot.type === 'AI' ? 'active' : ''}" disabled>
                  AI
                </button>
              </div>
            </div>
          {/each}
        </div>

        <!-- Game Settings Display -->
        <div class="game-settings">
          <div class="setting-row">
            <span class="setting-label">AI</span>
            <div class="setting-buttons">
              <button class="setting-button active">Nice</button>
              <button class="setting-button">Rude</button>
              <button class="setting-button">Mean</button>
              <button class="setting-button">Evil</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Turns</span>
            <div class="setting-buttons">
              <button class="setting-button">3</button>
              <button class="setting-button active">10</button>
              <button class="setting-button">15</button>
              <button class="setting-button">Endless</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Time (sec)</span>
            <div class="setting-buttons">
              <button class="setting-button">10</button>
              <button class="setting-button">30</button>
              <button class="setting-button">60</button>
              <button class="setting-button active">Unlimited</button>
            </div>
          </div>

          <div class="setting-row">
            <span class="setting-label">Map size</span>
            <div class="setting-buttons">
              <button class="setting-button">Small</button>
              <button class="setting-button active">Medium</button>
              <button class="setting-button">Large</button>
            </div>
          </div>
        </div>

        <!-- Status and Actions -->
        <div class="status-section">
          {#if game && game.players.length < 4}
            <p class="waiting-text">Waiting for players to join open slots...</p>
          {:else}
            <p class="waiting-text">All slots filled - ready to start!</p>
          {/if}

          <div class="action-buttons">
            {#if isCreator}
              <Button variant="success" size="lg" on:click={startGame}>
                Start anyway
              </Button>
            {/if}
            <Button variant="danger" size="lg" on:click={leaveGame}>
              Leave
            </Button>
          </div>
        </div>
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
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .waiting-room-container {
    background: #2c3e50;
    border: 2px solid #34495e;
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 500px;
    color: white;
  }

  .header h1 {
    margin: 0 0 20px 0;
    text-align: center;
    color: #ecf0f1;
    font-size: 1.4em;
    background: #34495e;
    padding: 10px;
    border-radius: 4px;
  }

  .player-slot {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
  }

  .player-name {
    flex: 1;
    font-size: 1.1em;
  }

  .player-controls {
    display: flex;
    gap: 4px;
  }

  .slot-button {
    padding: 4px 8px;
    border: 1px solid #555;
    background: #444;
    color: #aaa;
    border-radius: 3px;
    font-size: 0.9em;
    cursor: not-allowed;
  }

  .slot-button.active {
    background: #666;
    color: white;
    border-color: #777;
  }

  .game-settings {
    margin: 20px 0;
    background: #34495e;
    padding: 15px;
    border-radius: 4px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }

  .setting-row:last-child {
    margin-bottom: 0;
  }

  .setting-label {
    width: 120px;
    font-weight: bold;
    color: #ecf0f1;
  }

  .setting-buttons {
    display: flex;
    gap: 4px;
  }

  .setting-button {
    padding: 4px 12px;
    border: 1px solid #555;
    background: #444;
    color: #aaa;
    border-radius: 3px;
    font-size: 0.9em;
    cursor: not-allowed;
  }

  .setting-button.active {
    background: #666;
    color: white;
    border-color: #777;
  }

  .status-section {
    text-align: center;
    margin-top: 20px;
  }

  .waiting-text {
    margin: 15px 0;
    color: #bdc3c7;
    font-style: italic;
  }

  .action-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
  }

  .action-buttons :global(.btn-lg) {
    padding: 12px 24px;
    font-size: 1em;
  }

  .loading {
    text-align: center;
    padding: 40px;
  }

  .error-message {
    background: #e74c3c;
    color: white;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
    text-align: center;
  }
</style>
