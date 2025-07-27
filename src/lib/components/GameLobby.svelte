<!-- src/lib/components/GameLobby.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const dispatch = createEventDispatcher();

  export let gameMode = 'join'; // 'join' or 'create'

  let openGames = [];
  let loading = true;
  let error = null;

  // Fixed player names like the GAS version
  const FIXED_PLAYER_NAMES = [
    'Red Baron',
    'Blue Thunder',
    'Green Dragon',
    'Yellow Storm'
  ];

  onMount(() => {
    loadOpenGames();
    // Auto-refresh every 3 seconds
    const interval = setInterval(loadOpenGames, 3000);
    return () => clearInterval(interval);
  });

  async function loadOpenGames() {
    try {
      const response = await fetch('/api/games/open');
      if (response.ok) {
        openGames = await response.json();
      } else {
        openGames = [];
      }
    } catch (err) {
      console.error('Failed to load games:', err);
      openGames = [];
    } finally {
      loading = false;
    }
  }

  async function joinGame(gameId) {
    try {
      // Find next available player slot name
      const game = openGames.find(g => g.gameId === gameId);
      const takenSlots = game?.playerCount || 0;
      const playerName = FIXED_PLAYER_NAMES[takenSlots];

      const response = await fetch(`/api/game/${gameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName })
      });

      if (response.ok) {
        const result = await response.json();
        const player = result.player;

        localStorage.setItem(`wc_game_${gameId}`, JSON.stringify({
          playerId: player.index.toString(),  // Use index as playerId
          playerIndex: player.index,
          playerName: player.name
        }));
        goto(`/game/${gameId}`);
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to join game';
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
      setTimeout(() => error = null, 3000);
    }
  }

  async function createNewGame() {
    try {
      const playerName = FIXED_PLAYER_NAMES[0]; // Always start as first player

      const response = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          gameType: 'MULTIPLAYER',
          maxPlayers: 4
        })
      });

      if (response.ok) {
        const result = await response.json();
        const player = result.player || { index: 0, name: playerName };

        localStorage.setItem(`wc_game_${result.gameId}`, JSON.stringify({
          playerId: player.index.toString(),
          playerIndex: player.index,
          playerName: player.name
        }));
        goto(`/game/${result.gameId}`);
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to create game';
        setTimeout(() => error = null, 3000);
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
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
</script>

<!-- Full screen overlay matching GAS styling -->
<div class="lobby-overlay">
  <div class="lobby-container">
    <div class="lobby-header">
      <h1>Select Game
        <br/>
        <span class="title-subheader">
          {#if gameMode === 'create'}
            Create a new game or join an existing one
          {:else}
            Select an open slot in a game or create a new game
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

      {#if loading}
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>Loading available games...</p>
        </div>
      {:else}
        <div class="games-panel">
          {#if openGames.length === 0}
            <div class="no-games">
              <div class="no-games-icon">🎮</div>
              <h3>No open games available</h3>
              <p>Be the first to start a new World Conflict battle!</p>
            </div>
          {:else}
            <div class="games-list">
              <h3>Available Games ({openGames.length})</h3>
              {#each openGames as game}
                <div class="game-row">
                  <div class="game-info">
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
                      <span class="separator">•</span>
                      <span class="game-type">
                        {game.gameType}
                      </span>
                    </div>
                  </div>
                  <button
                    class="join-button"
                    on:click={() => joinGame(game.gameId)}
                    disabled={game.playerCount >= game.maxPlayers}
                  >
                    {game.playerCount >= game.maxPlayers ? 'Full' : 'Join'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Bottom actions -->
    <div class="bottom-box">
      <button class="new-game-button" on:click={createNewGame}>
        New Game
      </button>

      <button class="cancel-button" on:click={close}>
        Back
      </button>
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
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    color: white;
    font-family: system-ui, sans-serif;
  }

  .lobby-container {
    max-width: 700px;
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
    background: linear-gradient(135deg, #60a5fa, #a855f7, #ec4899);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
  }

  .title-subheader {
    font-size: 1.2rem;
    color: #94a3b8;
    font-weight: normal;
  }

  .lobby-content {
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid #475569;
    border-radius: 12px;
    padding: 2rem;
    min-height: 300px;
    max-height: 400px;
    overflow-y: auto;
    backdrop-filter: blur(10px);
    flex: 1;
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

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 1rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #374151;
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .no-games {
    text-align: center;
    padding: 3rem 1rem;
  }

  .no-games-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .no-games h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #f8fafc;
  }

  .no-games p {
    color: #94a3b8;
  }

  .games-list h3 {
    margin-bottom: 1.5rem;
    color: #f8fafc;
    font-size: 1.3rem;
  }

  .game-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    transition: all 0.2s;
  }

  .game-row:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: #60a5fa;
  }

  .game-info {
    flex: 1;
  }

  .game-title {
    font-weight: 600;
    font-size: 1.1rem;
    color: #f8fafc;
    margin-bottom: 0.25rem;
  }

  .game-details {
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .separator {
    margin: 0 0.5rem;
  }

  .player-count {
    color: #60a5fa;
    font-weight: 500;
  }

  .join-button {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .join-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669, #047857);
    transform: translateY(-1px);
  }

  .join-button:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }

  .bottom-box {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .new-game-button {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .new-game-button:hover {
    background: linear-gradient(135deg, #1d4ed8, #1e40af);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .cancel-button {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #475569;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    color: white;
    border-color: #60a5fa;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .lobby-container {
      width: 95%;
    }

    .lobby-header h1 {
      font-size: 2rem;
    }

    .lobby-content {
      padding: 1.5rem;
    }

    .game-row {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .join-button {
      align-self: center;
      width: 100px;
    }

    .bottom-box {
      flex-direction: column;
    }

    .new-game-button,
    .cancel-button {
      width: 100%;
    }
  }
</style>
