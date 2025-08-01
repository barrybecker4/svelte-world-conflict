<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Map from './Map.svelte';
  import PlayerNameInput from './PlayerNameInput.svelte';
  import PlayerConfiguration from './PlayerConfiguration.svelte';
  import GameSettingsPanel from './GameSettingsPanel.svelte';
  import MapPreviewPanel from './MapPreviewPanel.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import Button from '$lib/components/buttons/Button.svelte';

  const dispatch = createEventDispatcher();

  // Game settings - now managed by GameSettingsPanel
  let gameSettings = {
    aiDifficulty: 'Nice',
    turns: 10,
    timeLimit: 30,
    mapSize: 'Large'
  };

  // Player name input
  let playerName = '';
  const PLAYER_NAME_KEY = 'wc_player_name';

  // Player slot states - Off/Set/Open/AI as per original
  let playerSlots = [
    { ...getPlayerConfig(0), type: 'Off', customName: '' },
    { ...getPlayerConfig(1), type: 'Off', customName: '' },
    { ...getPlayerConfig(2), type: 'Off', customName: '' },
    { ...getPlayerConfig(3), type: 'Off', customName: '' }
  ];

  let creating = false;
  let error = null;
  let showNameInput = true;
  let mapPreviewPanel;

  // Count active players for map generation
  $: activePlayerCount = playerSlots.filter(slot => slot.type !== 'Off').length;

  function loadStoredPlayerName() {
    try {
      const storedName = localStorage.getItem(PLAYER_NAME_KEY);
      if (storedName && storedName.trim()) {
        playerName = storedName.trim();
        showNameInput = false;
        return true;
      }
    } catch (error) {
      console.warn('Failed to load stored player name:', error);
    }
    return false;
  }

  function savePlayerName(name) {
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name.trim());
    } catch (error) {
      console.warn('Failed to save player name:', error);
    }
  }

  // Handle player name submission from the PlayerNameInput component
  function handleNameSubmitted(event) {
    const { name } = event.detail;
    playerName = name;
    proceedWithName();
  }

  function proceedWithName() {
    if (!playerName.trim()) {
      error = 'Please enter a name';
      return;
    }

    // Save the name to localStorage
    savePlayerName(playerName);

    initPlayerConfig(playerName);

    // Hide the name input and show the main configuration
    showNameInput = false;
    error = null;
  }

  function initPlayerConfig(playerName) {
    // Set the first player slot to "Set" with the custom name
    playerSlots[0] = {
      ...getPlayerConfig(0),
      type: 'Set',
      customName: playerName
    };

    // Set some AI opponents by default
    playerSlots[1] = { ...getPlayerConfig(1), type: 'AI', customName: '' };
    playerSlots[2] = { ...getPlayerConfig(2), type: 'AI', customName: '' };
    playerSlots[3] = { ...getPlayerConfig(3), type: 'Off', customName: '' };

    // Trigger reactivity
    playerSlots = [...playerSlots];
  }

  function changeName() {
    showNameInput = true;
  }

  // Handle player slot updates from PlayerConfiguration components
  function handleSlotUpdated(event) {
    const { index, slot } = event.detail;

    // If changing to "Set", we need to handle the current player switching
    if (slot.type === 'Set') {
      // Find the current "Set" slot and change it to "Off"
      const currentSetIndex = playerSlots.findIndex(s => s.type === 'Set');
      if (currentSetIndex !== -1 && currentSetIndex !== index) {
        playerSlots[currentSetIndex] = {
          ...playerSlots[currentSetIndex],
          type: 'Off',
          customName: ''
        };
      }

      // Set the new slot to "Set" with the current player's name
      playerSlots[index] = {
        ...slot,
        type: 'Set',
        customName: playerName
      };
    } else {
      // For other types, just update normally
      playerSlots[index] = { ...slot };
    }

    // Trigger reactivity - this is crucial for the map preview to update
    playerSlots = [...playerSlots];
  }

  // Reactive statement to refresh map preview when map size changes
  $: if (mapPreviewPanel && gameSettings.mapSize) {
    mapPreviewPanel.refreshPreview();
  }

  async function createGame() {
    if (creating) return;

    try {
      creating = true;
      error = null;

      // Validate at least one active player
      const activePlayers = playerSlots.filter(slot => slot.type !== 'Off');
      if (activePlayers.length < 2) {
        throw new Error('At least 2 players are required');
      }

      // Build the game configuration
      const gameConfig = {
        settings: gameSettings,
        playerSlots: playerSlots.map(slot => ({
          index: slot.index,
          type: slot.type, // Include the type so parent can find the human player
          name: slot.type === 'Set' ? slot.customName : slot.defaultName,
          customName: slot.customName
        }))
      };

      console.log('Creating game with config:', gameConfig);

      // Dispatch to parent
      dispatch('gameCreated', gameConfig);

    } catch (err) {
      console.error('Error creating game:', err);
      error = err.message || 'Failed to create game';
    } finally {
      creating = false;
    }
  }

  // Initialize player name on mount
  onMount(() => {
    if (loadStoredPlayerName()) {
      initPlayerConfig(playerName);
    }
  });
</script>

<div class="game-configuration">
  {#if showNameInput}
    <div class="name-input-container">
      <PlayerNameInput
        initialName={playerName}
        on:nameSubmitted={handleNameSubmitted}
        {error}
      />
    </div>
  {:else}
    <div class="configuration-main">
      <div class="config-panel">
        <h2>Game Setup</h2>

        <!-- Current Player Section -->
        <div class="current-player-section">
          <h3>Current Player</h3>
          <div class="current-player">
            <span class="player-label">Playing as:</span>
            <span class="player-name-display">{playerName}</span>
            <Button variant="ghost" size="sm" on:click={changeName}>
              Change
            </Button>
          </div>
        </div>

        <!-- Players Section -->
        <div class="players-section">
          <h3>Players</h3>
          {#each playerSlots as slot, index (slot.index)}
            <PlayerConfiguration
              playerSlot={slot}
              {index}
              on:slotUpdated={handleSlotUpdated}
            />
          {/each}
        </div>

        <!-- Game Settings -->
        <GameSettingsPanel bind:gameSettings />

        <!-- Create Game Section -->
        <div class="create-game-section">
          {#if error}
            <div class="error-message">{error}</div>
          {/if}

          <Button
            variant="primary"
            size="lg"
            disabled={activePlayerCount < 2}
            loading={creating}
            on:click={createGame}
          >
            Create Game
          </Button>
        </div>
      </div>

      <!-- Pass playerSlots to MapPreviewPanel so it can show home bases -->
      <MapPreviewPanel
        bind:this={mapPreviewPanel}
        mapSize={gameSettings.mapSize}
        playerCount={Math.max(activePlayerCount, 2)}
        {playerSlots}
      />
    </div>
  {/if}
</div>

<style>
  .game-configuration {
    min-height: 100vh;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .configuration-main {
    display: flex;
    gap: 32px;
    /*max-width: 1200px;*/
    width: 100%;
    height: 80vh;
    min-height: 600px;
  }

  .config-panel {
    background: rgba(30, 41, 59, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid #475569;
    border-radius: 12px;
    padding: 24px;
    overflow-y: auto;
    min-width: 400px;
    max-height: 100%;
  }

  .config-panel h2 {
    font-size: 24px;
    color: #f8fafc;
    margin-bottom: 16px;
  }

  .config-panel h3 {
    font-size: 20px;
    color: #f8fafc;
    margin-bottom: 8px;
  }

  .current-player-section {
    margin-bottom: 24px;
    padding: 16px;
    background: #374151;
    border-radius: 8px;
  }

  .current-player {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .player-label {
    font-weight: 500;
    color: #94a3b8;
  }

  .player-name-display {
    font-weight: 600;
    color: #f8fafc;
    font-size: 1.1rem;
  }

  .players-section {
    margin-bottom: 24px;
  }

  .create-game-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #475569;
  }

  .error-message {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 12px;
    font-size: 0.9rem;
  }

  .create-game-section :global(.btn-lg) {
    width: 100%;
  }
</style>
