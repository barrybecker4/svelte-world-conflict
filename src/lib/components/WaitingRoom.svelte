<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LoadingState from '$lib/components/ui/LoadingState.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import { loadGameCreator, removeGameCreator } from '$lib/client/stores/clientStorage';

  const dispatch = createEventDispatcher();

  export let gameId: string;
  export let initialGame: any = null;

  let game = initialGame;
  let loading = !game;
  let error = null;
  let currentPlayerId = null;
  let isCreator = false;
  let wsConnected = false;

  onMount(async () => {
    const gameCreator = loadGameCreator(gameId);
    if (gameCreator) {
      currentPlayerId = gameCreator.playerIndex;
    }

    if (!game) {
      await loadGameState();
    }

    checkIfCreator();
    await setupRealtimeUpdates();

    // Refresh game state periodically only as backup
    if (!wsConnected) {
      console.log('wsConnected filed to connect! Falling back to polling');
      pollInterval = setInterval(() => {
          if (!wsConnected) {
            loadGameState();
          }
      }, 5000);
      return () => clearInterval(interval);
    }
  });

  async function setupRealtimeUpdates() {
    if (typeof window === 'undefined') return;

    try {
      // Dynamic import to avoid SSR issues
      const { multiplayerActions, gameUpdates, multiplayerState } = await import('$lib/client/stores/multiplayerStore');

      // Monitor connection state changes
      const stateUnsubscribe = multiplayerState.subscribe(state => {
        wsConnected = state.isConnected;
        if (state.lastError) {
          console.error(`WebSocket error: ${state.lastError}`);
        }
      });

      // Connect to WebSocket for this specific game
      await multiplayerActions.connectToGame(gameId);
      console.log(`WebSocket connected for game ${gameId}`);

      // Subscribe to game updates
      const gameUnsubscribe = gameUpdates.subscribe(update => {
        if (update && update.gameId === gameId) {
          console.log(`📨 Real-time update for game ${gameId}:`, {
            type: update.type,
            data: update.data,
            timestamp: new Date().toISOString()
          });

          if (update.type === 'playerJoined' || update.type === 'gameUpdate') {
            console.log(`🔄 Triggering game state reload due to ${update.type}`);
            loadGameState();
          } else if (update.type === 'gameStarted') {
            console.log('🚀 Game started - dispatching event...');
            dispatch('gameStarted', { gameId });
          }
        }
      });

      return () => {   // Cleanup
        stateUnsubscribe();
        gameUnsubscribe();
      };
    } catch (error) {
      console.log('Real-time updates not available:', error.message);
      wsConnected = false;
    }
  }

  async function loadGameState() {
    try {
      console.log(`🔄 Loading game state for ${gameId}...`);

      const response = await fetch(`/api/game/${gameId}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to load game state: ${response.status}`, errorData);
        error = `Failed to load game: ${errorData.error || response.statusText}`;
        return; // Don't update game state on error
      }

      const gameData = await response.json();
      console.log(`📥 Received game data:`, {
        gameId: gameData?.gameId,
        status: gameData?.status,
        playersLength: gameData?.players?.length,
        hasConfig: !!(gameData?.pendingConfiguration || gameData?.configuration),
        fullData: gameData
      });

      console.log(`✅ Game state updated successfully`);
      game = gameData;
      error = null; // Clear any previous errors
    } catch (err) {
      console.error('❌ Error loading game state:', err);
      error = 'Network error loading game';
      setTimeout(() => error = null, 3000);
    } finally {
      loading = false;
    }
  }

  function checkIfCreator() {
    if (game && currentPlayerId !== null) {
      // Check if current player is the first player (creator)
      const creator = game.players?.find(p => p.index === 0);
      isCreator = creator && currentPlayerId === creator.index;
    }
  }

  async function startGame() {
    try {
      console.log('🚀 Manually starting game...');
      const response = await fetch(`/api/game/${gameId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Game started successfully');
        dispatch('gameStarted', { gameId });
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to start game';
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error starting game';
      setTimeout(() => error = null, 3000);
    }
  }

  async function leaveGame() {
    try {
      console.log('🚪 Leaving game...');
      const response = await fetch(`/api/game/${gameId}/quit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        removeGameCreator(gameId);
        console.log('✅ Successfully left game');
        dispatch('gameLeft');
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to leave game';
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error leaving game';
      setTimeout(() => error = null, 3000);
    }
  }

  // Helper function to get player slot display info
  function getSlotInfo(slotIndex) {
    if (game?.pendingConfiguration?.playerSlots) {
      const slot = game.pendingConfiguration.playerSlots[slotIndex];
      if (!slot || slot.type === 'Off') {
        return { type: 'disabled', name: 'Disabled', color: '#6b7280' };
      }
      if (slot.type === 'Set') {
        return { type: 'creator', name: slot.name, color: '#3b82f6' };
      }
      if (slot.type === 'AI') {
        return { type: 'ai', name: slot.name, color: '#8b5cf6' };
      }
      if (slot.type === 'Open') {
        // Check if this slot is taken by a player
        const player = game.players?.find(p => p.index === slotIndex);
        if (player) {
          return {
            type: 'taken',
            name: player.name,
            color: getPlayerConfig(slotIndex).color,
            isCurrentPlayer: currentPlayerId === slotIndex
          };
        }
        return { type: 'open', name: 'Waiting...', color: '#10b981' };
      }
    }

    // Fallback for games without proper configuration
    const player = game?.players?.find(p => p.index === slotIndex);
    if (player) {
      return {
        type: 'taken',
        name: player.name,
        color: getPlayerConfig(slotIndex).color,
        isCurrentPlayer: currentPlayerId === slotIndex
      };
    }
    return { type: 'open', name: 'Waiting...', color: '#10b981' };
  }

  function getOpenSlotsCount() {
    if (!game?.pendingConfiguration?.playerSlots) return 0;

    return game.pendingConfiguration.playerSlots.filter((slot, index) => {
      if (!slot || slot.type !== 'Open') return false;
      return !game.players?.some(p => p.index === index);
    }).length;
  }

  function getActivePlayersCount() {
    return game?.players?.length || 0;
  }
</script>

<div class="waiting-room-overlay">
  <div class="waiting-room-container">
    <LoadingState {loading} loadingText="Loading game...">

      {#if error}
        <div class="error-message">
          ⚠️ {error}
        </div>
      {/if}

      <div class="header">
        <h1>
          🎮 Waiting Room
          {#if wsConnected}
            <span class="connection-status connected">● Live</span>
          {:else}
            <span class="connection-status disconnected">○ Updating</span>
          {/if}
        </h1>
        {#if game}
          <div class="game-info">
            <span class="game-id">Game: {gameId}</span>
            <span class="separator">•</span>
            <span class="player-status">
              {getActivePlayersCount()}/{game.pendingConfiguration?.playerSlots?.filter(s => s && s.type !== 'Off').length || 4} players
            </span>
          </div>
        {/if}
      </div>

      {#if game}
        <div class="players-section">
          <h2>Players</h2>
          <div class="player-slots">
            {#each Array(4) as _, slotIndex}
              {@const slotInfo = getSlotInfo(slotIndex)}
              <div class="player-slot {slotInfo.type}" class:current-player={slotInfo.isCurrentPlayer}>
                <div class="slot-header">
                  <span class="slot-label">Player {slotIndex + 1}</span>
                  {#if slotInfo.isCurrentPlayer}
                    <span class="current-indicator">You</span>
                  {/if}
                </div>
                <div class="slot-content" style="border-left-color: {slotInfo.color};">
                  <span class="player-name">{slotInfo.name}</span>
                  {#if slotInfo.type === 'open'}
                    <div class="waiting-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="game-settings-section">
          <h3>Game Settings</h3>
          <div class="settings-grid">
            <div class="setting-item">
              <span class="setting-label">Map Size:</span>
              <span class="setting-value">{game.pendingConfiguration?.settings?.mapSize || 'Medium'}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">AI Difficulty:</span>
              <span class="setting-value">{game.pendingConfiguration?.settings?.aiDifficulty || 'Normal'}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Turn Limit:</span>
              <span class="setting-value">{game.pendingConfiguration?.settings?.maxTurns || 'Unlimited'}</span>
            </div>
            <div class="setting-item">
              <span class="setting-label">Time Limit:</span>
              <span class="setting-value">{game.pendingConfiguration?.settings?.timeLimit || 'None'}</span>
            </div>
          </div>
        </div>

        <div class="status-section">
          {#if getOpenSlotsCount() > 0}
            <p class="waiting-text">
              ⏳ Waiting for {getOpenSlotsCount()} more player{getOpenSlotsCount() > 1 ? 's' : ''} to join...
            </p>
            <p class="help-text">Share this game ID with friends: <strong>{gameId}</strong></p>
          {:else}
            <p class="waiting-text ready">
              ✅ All slots filled - ready to start!
            </p>
          {/if}

          <div class="action-buttons">
            {#if isCreator}
              <Button
                variant="success"
                size="lg"
                on:click={startGame}
                disabled={loading}
              >
                {getOpenSlotsCount() > 0 ? 'Start Anyway' : 'Start Game'}
              </Button>
            {/if}
            <Button
              variant="danger"
              size="lg"
              on:click={leaveGame}
              disabled={loading}
            >
              Leave Game
            </Button>
          </div>
        </div>
      {/if}
    </LoadingState>
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

  .connection-status {
    font-size: 0.8rem;
    margin-left: 1rem;
    font-weight: 500;
  }

  .connection-status.connected {
    color: #10b981;
  }

  .connection-status.disconnected {
    color: #f59e0b;
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

  .player-slot {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.3s;
  }

  .player-slot.current-player {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  .slot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .slot-label {
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .current-indicator {
    background: #3b82f6;
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .slot-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 0.75rem;
    border-left: 4px solid;
  }

  .player-name {
    font-weight: 600;
    font-size: 1rem;
  }

  .player-slot.disabled .player-name {
    opacity: 0.5;
    font-style: italic;
  }

  .player-slot.ai .player-name {
    opacity: 0.8;
    font-style: italic;
  }

  .waiting-dots {
    display: flex;
    gap: 0.2rem;
  }

  .waiting-dots span {
    animation: blink 1.5s ease-in-out infinite;
    font-size: 1.2rem;
    color: #10b981;
  }

  .waiting-dots span:nth-child(1) { animation-delay: 0s; }
  .waiting-dots span:nth-child(2) { animation-delay: 0.3s; }
  .waiting-dots span:nth-child(3) { animation-delay: 0.6s; }

  @keyframes blink {
    0%, 70%, 100% { opacity: 0.3; }
    35% { opacity: 1; }
  }

  .game-settings-section {
    margin-bottom: 2rem;
    padding: 1rem;
    background: rgba(30, 41, 59, 0.4);
    border-radius: 8px;
  }

  .game-settings-section h3 {
    margin: 0 0 1rem 0;
    color: #f1f5f9;
    font-size: 1.1rem;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setting-label {
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .setting-value {
    color: #f1f5f9;
    font-weight: 600;
    font-size: 0.9rem;
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

  /* Responsive */
  @media (max-width: 640px) {
    .waiting-room-container {
      width: 95%;
      padding: 1.5rem;
    }

    .player-slots {
      grid-template-columns: 1fr;
    }

    .settings-grid {
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
</style>