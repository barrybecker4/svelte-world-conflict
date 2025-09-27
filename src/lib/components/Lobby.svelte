<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import PlayerNameInput from '$lib/components/configuration/PlayerNameInput.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import { loadPlayerName, savePlayerName, saveGameCreator } from '$lib/client/stores/clientStorage';

  const dispatch = createEventDispatcher();

  let openGames = [];
  let loading = true;
  let error = null;

  // Name prompt state
  let showNamePrompt = false;
  let pendingJoinGameId = null;
  let pendingJoinSlot = null;
  let joiningPlayerName = '';
  let nameError = '';

  onMount(() => {
    loadOpenGames();
    // Auto-refresh every 10 seconds as backup (reduced or remove this since we have real-time updates)
    const intervalId = setInterval(loadOpenGames, 5000);
    return () => clearInterval(intervalId);
  });

  async function loadOpenGames() {
    try {
      const response = await fetch('/api/games/open');

      if (response.ok) {
        openGames = await response.json();
        openGames.sort((a, b) => b.createdAt - a.createdAt);
        console.log(`✅ Loaded ${openGames.length} open games`);
      } else {
        console.error('❌ Failed to fetch open games:', response.status);
        openGames = [];
      }
    } catch (err) {
      console.error('❌ Failed to load games:', err);
      openGames = [];
    } finally {
      loading = false;
    }
  }

  async function joinGameInSlot(gameId, slotIndex) {
    // First, check if player has a stored name
    const storedName = loadPlayerName();

    if (storedName) {
      // Check if name conflicts with existing players in this game
      const game = openGames.find(g => g.gameId === gameId);
      const nameInUse = game?.players?.some(p => p.name === storedName);

      if (nameInUse) {
        // Name conflict - prompt for different name
        pendingJoinGameId = gameId;
        pendingJoinSlot = slotIndex;
        joiningPlayerName = '';
        nameError = `Name "${storedName}" is already in use. Please choose another.`;
        showNamePrompt = true;
      } else {
        // Use stored name
        await performJoin(gameId, slotIndex, storedName);
      }
    } else {
      // No stored name - prompt for one
      pendingJoinGameId = gameId;
      pendingJoinSlot = slotIndex;
      joiningPlayerName = '';
      nameError = '';
      showNamePrompt = true;
    }
  }

  function handleNameSubmitted(event) {
    const { name } = event.detail;
    const trimmedName = name.trim();

    if (!trimmedName) {
      nameError = 'Please enter a name';
      return;
    }

    // Check for name conflicts in the target game
    const game = openGames.find(g => g.gameId === pendingJoinGameId);
    const nameInUse = game?.players?.some(p => p.name === trimmedName);

    if (nameInUse) {
      nameError = `Name "${trimmedName}" is already in use. Please choose another.`;
      return;
    }

    // Save the name for future use
    savePlayerName(trimmedName);

    // Perform the join
    performJoin(pendingJoinGameId, pendingJoinSlot, trimmedName);

    // Close dialog
    cancelNamePrompt();
  }

  async function performJoin(gameId, slotIndex, playerName) {
    try {
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

  function cancelNamePrompt() {
    showNamePrompt = false;
    pendingJoinGameId = null;
    pendingJoinSlot = null;
    joiningPlayerName = '';
    nameError = '';
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
        </span>
      </h1>
      <Button variant="secondary" on:click={close}>
        Create New Game
      </Button>
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Loading games...</div>
    {:else if openGames.length === 0}
      <div class="no-games">
        <p>No open games available</p>
        <p class="no-games-hint">Create a new game to get started!</p>
        <Button variant="primary" on:click={close}>
          Create New Game
        </Button>
      </div>
    {:else}
      <div class="games-list">
        {#each openGames as game (game.gameId)}
          <Panel variant="dark" blur={true}>
            <div class="game-card">
              <div class="game-info">
                <div class="game-title">{game.creator}'s Game</div>
                <div class="game-meta">
                  <span>Created {formatTimeAgo(game.createdAt)}</span>
                  <span>•</span>
                  <span>{game.players?.length || 0}/{game.maxPlayers} players</span>
                </div>
              </div>

              <div class="player-slots">
                {#each Array(game.maxPlayers) as _, slotIndex}
                  {@const slotInfo = getSlotInfo(game, slotIndex)}
                  <Button
                    variant={getSlotButtonVariant(slotInfo)}
                    disabled={!slotInfo.canJoin}
                    on:click={() => slotInfo.canJoin && joinGameInSlot(game.gameId, slotIndex)}
                  >
                    {slotInfo.name}
                  </Button>
                {/each}
              </div>
            </div>
          </Panel>
        {/each}
      </div>
    {/if}
  </div>

  {#if showNamePrompt}
    <div class="modal-overlay" on:click={cancelNamePrompt}>
      <div class="modal-content" on:click|stopPropagation>
        <div class="modal-header">
          <h2>Join Game</h2>
          <button class="close-button" on:click={cancelNamePrompt}>×</button>
        </div>

        <PlayerNameInput
          initialName={joiningPlayerName}
          error={nameError}
          on:nameSubmitted={handleNameSubmitted}
        />

        <div class="modal-footer">
          <Button variant="secondary" on:click={cancelNamePrompt}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .lobby-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .lobby-container {
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .lobby-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .lobby-header h1 {
    color: #f8fafc;
    font-size: 2rem;
    margin: 0;
  }

  .title-subheader {
    font-size: 1rem;
    color: #cbd5e1;
    font-weight: normal;
  }

  .error-banner {
    background: #dc2626;
    color: white;
    padding: 12px;
    border-radius: 6px;
    text-align: center;
  }

  .loading, .no-games {
    text-align: center;
    color: #cbd5e1;
    padding: 40px;
  }

  .no-games {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .no-games p {
    margin: 0;
    font-size: 1.125rem;
  }

  .no-games-hint {
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .games-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .game-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .game-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .game-title {
    color: #f8fafc;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .game-meta {
    color: #94a3b8;
    font-size: 0.875rem;
    display: flex;
    gap: 8px;
  }

  .player-slots {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .player-slots :global(button) {
    flex: 1;
    min-width: 120px;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .modal-content {
    background: #1f2937;
    border-radius: 12px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 16px;
    border-bottom: 1px solid #374151;
  }

  .modal-header h2 {
    color: #f8fafc;
    font-size: 1.5rem;
    margin: 0;
  }

  .close-button {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #374151;
    color: #f8fafc;
  }

  .modal-content :global(.name-input-section) {
    padding: 24px;
    border-bottom: 1px solid #374151;
  }

  .modal-content :global(.name-input-section h2) {
    display: none;
  }

  .modal-footer {
    padding: 16px 24px;
    display: flex;
    justify-content: flex-end;
  }
</style>
