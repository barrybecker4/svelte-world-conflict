<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import { saveGameCreator } from '$lib/client/stores/clientStorage';

  const dispatch = createEventDispatcher();

  let openGames = [];
  let loading = true;
  let error = null;
  let wsConnected = false;

  onMount(() => {
    loadOpenGames();
    setupRealtimeUpdates();

    // Auto-refresh every 10 seconds as backup (reduced frequency since we have real-time updates)
    const interval = setInterval(loadOpenGames, 10000);
    return () => clearInterval(interval);
  });

  async function setupRealtimeUpdates() {
    // Only run in browser
    if (typeof window === 'undefined') return;

    try {
      // Dynamic import to avoid SSR issues
      const { multiplayerActions, gameUpdates } = await import('$lib/client/stores/multiplayerStore');

      // Connect to WebSocket for real-time lobby updates
      await multiplayerActions.connectToGame('lobby');
      wsConnected = true;
      console.log('🔌 Connected to lobby WebSocket');

      // Subscribe to game updates
      const unsubscribe = gameUpdates.subscribe(update => {
        if (update && (update.type === 'playerJoined' || update.type === 'gameUpdate')) {
          console.log('🔄 Real-time update received, refreshing lobby...');
          loadOpenGames(); // Refresh the lobby to show updated counts
        }
      });

      // Store cleanup function
      return () => {
        unsubscribe();
        multiplayerActions.disconnect();
        wsConnected = false;
      };
    } catch (error) {
      console.log('Real-time updates not available:', error.message);
      wsConnected = false;
    }
  }

  async function loadOpenGames() {
    try {
      console.log('🔄 Loading open games...');
      const response = await fetch('/api/games/open');
      if (response.ok) {
        const games = await response.json();

        // ✅ Log the received data for debugging
        console.log(`✅ Received ${games.length} games:`, games);

        openGames = games.sort((a, b) => b.createdAt - a.createdAt);

        // If no games available, automatically go to game configuration
        if (openGames.length === 0 && !loading) {
          console.log('📝 No open games found, switching to configuration');
          dispatch('close');
          return;
        }
      } else {
        console.error('❌ Failed to fetch open games:', response.status);
        openGames = [];
      }
    } catch (err) {
      console.error('❌ Failed to load games:', err);
      openGames = [];
    } finally {
      loading = false;
      if (openGames.length === 0) {
        dispatch('close');
      }
    }
  }

  async function joinGameInSlot(gameId, slotIndex) {
    try {
      // Get player name for this slot
      let playerName;
      try {
        playerName = getPlayerConfig(slotIndex).defaultName;
      } catch (error) {
        // Fallback if getPlayerConfig fails
        const defaultNames = ['Crimson', 'Azure', 'Emerald', 'Golden'];
        playerName = defaultNames[slotIndex] || `Player${slotIndex + 1}`;
      }

      console.log(`🎮 Attempting to join game ${gameId} in slot ${slotIndex} as "${playerName}"`);

      const response = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, preferredSlot: slotIndex })
      });

      if (response.ok) {
        const result = await response.json();
        const player = result.player;

        saveGameCreator(gameId, {
          playerId: player.slotIndex.toString(),
          playerSlotIndex: player.slotIndex,
          playerName: player.name
        });

        console.log(`✅ Successfully joined as player ${player.slotIndex}: ${player.name}`);

        // Route to game page - it will show waiting room if status is PENDING
        goto(`/game/${gameId}`);
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to join game';
        console.error('❌ Join game failed:', errorData);
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
      console.error('❌ Network error joining game:', err);
      setTimeout(() => error = null, 3000);
    }
  }

  function close() {
    dispatch('close');
  }

  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  // Helper function to get player slot display info
  function getSlotInfo(game, slotIndex) {
    if (game.pendingConfiguration?.playerSlots) {
      const slot = game.pendingConfiguration.playerSlots[slotIndex];
      if (!slot || slot.type === 'Off') {
        return { type: 'disabled', name: 'Disabled', canJoin: false };
      }
      if (slot.type === 'Set') {
        return { type: 'creator', name: slot.name, canJoin: false };
      }
      if (slot.type === 'AI') {
        return { type: 'ai', name: slot.name, canJoin: false };
      }
      if (slot.type === 'Open') {
        // Check if this slot is already taken by a player
        const player = game.players?.find(p => p.slotIndex === slotIndex);
        if (player) {
          return { type: 'taken', name: player.name, canJoin: false };
        }
        return { type: 'open', name: 'Open', canJoin: true };
      }
    }

    // Fallback for games without proper configuration
    const player = game.players?.find(p => p.slotIndex === slotIndex);
    if (player) {
      return { type: 'taken', name: player.name, canJoin: false };
    }
    return { type: 'open', name: 'Open', canJoin: slotIndex < game.maxPlayers };
  }

  // Get button variant based on slot type
  function getSlotButtonVariant(slotInfo) {
    switch (slotInfo.type) {
      case 'open': return 'success';
      case 'creator': return 'primary';
      case 'taken': return 'secondary';
      case 'ai': return 'ghost';
      case 'disabled': return 'ghost';
      default: return 'secondary';
    }
  }
</script>

<div class="lobby-overlay">
  <div class="lobby-container">

    <div class="lobby-header">
      <h1>Select Game
        <br />
        <span class="title-subheader">
          Click on an open player slot to join a game
          {#if wsConnected}
            <span class="connection-status connected">● Live</span>
          {:else}
            <span class="connection-status disconnected">○ Updating</span>
          {/if}
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
        on:retry={loadOpenGames}
      >
        <!-- Games List (only shown if there are games) -->
        {#if openGames.length > 0}
          <div class="games-list">
            <h3>Available Games ({openGames.length})</h3>
            {#each openGames as game}
              <div class="game-card">
                <div class="game-header">
                  <div class="game-title">
                    {game.creator}'s Game
                  </div>
                  <div class="game-details">
                    <span class="player-count">
                      {game.playerCount}/{game.maxPlayers} players
                    </span>
                    <span class="separator">•</span>
                    <span class="game-age">
                      {formatTimeAgo(game.createdAt)}
                    </span>
                  </div>
                </div>

                <!-- Player Slots Grid -->
                <div class="player-slots">
                  {#each Array(4) as _, slotIndex}
                    {@const slotInfo = getSlotInfo(game, slotIndex)}
                    <div class="player-slot">
                      <div class="slot-label">Player {slotIndex + 1}</div>
                      <Button
                        variant={getSlotButtonVariant(slotInfo)}
                        size="sm"
                        disabled={!slotInfo.canJoin}
                        on:click={() => slotInfo.canJoin && joinGameInSlot(game.gameId, slotIndex)}
                        class="slot-button {slotInfo.type}"
                      >
                        {slotInfo.name}
                      </Button>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </LoadingState>
    </div>

    <div class="bottom-box">
      <Button variant="primary" size="lg" on:click={close}>
        New Game
      </Button>
      <Button variant="ghost" size="lg" on:click={close}>
        Back
      </Button>
    </div>

  </div>
</div>

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

  .connection-status {
    font-size: 0.9rem;
    margin-left: 1rem;
  }

  .connection-status.connected {
    color: #10b981;
  }

  .connection-status.disconnected {
    color: #f59e0b;
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

  /* Game Card */
  .game-card {
    background: var(--bg-panel-light, rgba(30, 41, 59, 0.8));
    border: 1px solid var(--border-light, #475569);
    border-radius: var(--radius-lg, 8px);
    padding: 1.5rem;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .game-card:hover {
    border-color: var(--color-primary-400, #60a5fa);
    background: var(--bg-panel-light, rgba(30, 41, 59, 0.95));
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .game-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary, #f8fafc);
  }

  .game-details {
    font-size: 0.9rem;
    color: var(--text-tertiary, #94a3b8);
  }

  .separator {
    margin: 0 0.5rem;
    opacity: 0.5;
  }

  /* Player Slots */
  .player-slots {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .player-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .slot-label {
    font-size: 0.8rem;
    color: var(--text-tertiary, #94a3b8);
    font-weight: 500;
  }

  :global(.slot-button) {
    min-width: 120px;
    transition: all 0.2s;
  }

  :global(.slot-button.open:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  :global(.slot-button.creator) {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  }

  :global(.slot-button.taken) {
    opacity: 0.7;
  }

  :global(.slot-button.ai) {
    opacity: 0.6;
    font-style: italic;
  }

  :global(.slot-button.disabled) {
    opacity: 0.4;
  }

  .bottom-box {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 2rem 0 0;
  }

  /* Responsive */
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

    .connection-status {
      display: block;
      margin-top: 0.5rem;
      margin-left: 0;
    }

    .player-slots {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .game-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    :global(.slot-button) {
      min-width: 100px;
    }
  }
</style>
