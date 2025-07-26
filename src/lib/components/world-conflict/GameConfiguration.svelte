<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import GameMap from './GameMap.svelte';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';

  const dispatch = createEventDispatcher();

  // Fixed player configurations matching original
  const PLAYER_CONFIGS = [
    {
      index: 0,
      defaultName: 'Amber',
      colorStart: '#e3be2d',
      colorEnd: '#e0b321'
    },
    {
      index: 1,
      defaultName: 'Crimson',
      colorStart: '#dc2626',
      colorEnd: '#991b1b'
    },
    {
      index: 2,
      defaultName: 'Lavender',
      colorStart: '#9A3BF2',
      colorEnd: '#7B68EE'
    },
    {
      index: 3,
      defaultName: 'Emerald',
      colorStart: '#059669',
      colorEnd: '#047857'
    }
  ];

  // Game settings
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
    { ...PLAYER_CONFIGS[0], type: 'Off', customName: '' },
    { ...PLAYER_CONFIGS[1], type: 'Off', customName: '' },
    { ...PLAYER_CONFIGS[2], type: 'Off', customName: '' },
    { ...PLAYER_CONFIGS[3], type: 'Off', customName: '' }
  ];

  const slotTypes = ['Off', 'Set', 'Open', 'AI'];

  // Game state
  let creating = false;
  let error = null;
  let showNameInput = true;
  let previewRegions = [];
  let loadingPreview = false;
  const mapGenerator = new MapGenerator(800, 600);

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
      ...playerSlots[0],
      type: 'Set',
      customName: playerName.trim()
    };

    // Automatically add an AI opponent in the second slot
    playerSlots[1] = {
      ...playerSlots[1],
      type: 'AI',
    };

    // Update the array to trigger reactivity
    playerSlots = [...playerSlots];
  }

  function changeName() {
    // Allow user to change their stored name
    showNameInput = true;
    error = null;
  }

  // Count active players for map generation
  $: activePlayerCount = playerSlots.filter(slot => slot.type !== 'Off').length;

  // Load preview map locally using MapGenerator
  function loadPreviewMap() {
    loadingPreview = true;
    try {
      // Generate map using the new GAS-style generator
      previewRegions = mapGenerator.generateMap({
        size: gameSettings.mapSize,
        playerCount: Math.max(activePlayerCount, 2) // At least 2 players for preview
      });
      forceRandomizeAssignments(); // Randomize player assignments with new map
    } catch (err) {
      console.error('Error generating preview map:', err);
      previewRegions = []; // Fallback to empty
    } finally {
      loadingPreview = false;
    }
  }

  function changeSlotType(slotIndex, newType) {
    // Only one "Set" player allowed
    if (newType === 'Set') {
      // Clear any existing "Set" players
      playerSlots = playerSlots.map((slot, i) =>
        i === slotIndex
          ? { ...slot, type: 'Set' }
          : slot.type === 'Set'
            ? { ...slot, type: 'Off' }
            : slot
      );
    } else {
      playerSlots[slotIndex] = { ...playerSlots[slotIndex], type: newType };
    }
    playerSlots = [...playerSlots];

    // Regenerate map when player count changes
    if (previewRegions.length > 0) {
      loadPreviewMap();
    }
  }

  function forceRandomizeAssignments() {
    // Randomize neutral region assignments for preview
    previewRegions = previewRegions.map(region => ({
      ...region,
      owner: Math.random() < 0.7 ? null : Math.floor(Math.random() * activePlayerCount)
    }));
  }

  function createGame() {
    creating = true;
    error = null;

    try {
      const activeSlots = playerSlots.filter(slot => slot.type !== 'Off');

      if (activeSlots.length < 2) {
        error = 'At least 2 players are required';
        creating = false;
        return;
      }

      const gameConfig = {
        mapSize: gameSettings.mapSize,
        aiDifficulty: gameSettings.aiDifficulty,
        turns: gameSettings.turns,
        timeLimit: gameSettings.timeLimit,
        playerSlots: activeSlots.map(slot => ({
          type: slot.type,
          name: slot.type === 'Set' ? slot.customName : slot.defaultName,
          color: slot.colorStart
        }))
      };

      console.log('Creating game with config:', gameConfig);

      // Dispatch the event - the parent component will handle it
      dispatch('gameCreated', gameConfig);

      // Note: Don't reset 'creating' here - let the parent component handle success/failure

    } catch (err) {
      error = `Failed to create game: ${err.message}`;
      creating = false;
    }
  }

  // Load initial preview when component mounts
  onMount(() => {
    // Try to load stored player name first
    if (!loadStoredPlayerName()) {
      // If no stored name, show the input
      showNameInput = true;
    } else {
      initPlayerConfig(playerName);
    }

    loadPreviewMap();
  });
</script>

<div class="game-configuration">
  {#if showNameInput}
    <div class="name-input-section">
      <h2>Enter Your Name</h2>
      <input
        type="text"
        bind:value={playerName}
        placeholder="Your name"
        class="name-input"
        maxlength="20"
        on:keydown={(e) => e.key === 'Enter' && proceedWithName()}
      />
      <button
        on:click={proceedWithName}
        disabled={!playerName.trim()}
        class="proceed-button"
      >
        Continue
      </button>
      {#if error}
        <p class="error">{error}</p>
      {/if}
    </div>
  {:else}
    <div class="configuration-main">
      <div class="config-panel">
        <h2>Game Setup</h2>

        <div class="settings-section">

          <div class="players-section">
            <h3>Players</h3>
            {#each playerSlots as slot, index}
              <div class="player-slot">
                <div class="player-color" style="background: {slot.colorStart}"></div>
                <div class="player-info">
                  <span class="player-name">
                    {slot.type === 'Set' ? slot.customName : slot.defaultName}
                  </span>
                  <select
                    value={slot.type}
                    on:change={(e) => changeSlotType(index, e.target.value)}
                  >
                    {#each slotTypes as type}
                      <option value={type}>{type}</option>
                    {/each}
                  </select>
                </div>
              </div>
            {/each}
          </div>

          <div class="setting">
            <label>Map Size:</label>
            <select bind:value={gameSettings.mapSize} on:change={loadPreviewMap}>
              <option value="Small">Small</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
            </select>
          </div>

          <div class="setting">
            <label>AI Difficulty:</label>
            <select bind:value={gameSettings.aiDifficulty}>
              <option value="Nice">Nice</option>
              <option value="Nasty">Nasty</option>
              <option value="Evil">Evil</option>
            </select>
          </div>

          <div class="setting">
            <label>Turns:</label>
            <input
              type="number"
              bind:value={gameSettings.turns}
              min="5"
              max="50"
              class="number-input"
            />
          </div>

          <div class="setting">
            <label>Time Limit (seconds):</label>
            <input
              type="number"
              bind:value={gameSettings.timeLimit}
              min="10"
              max="300"
              class="number-input"
            />
          </div>
        </div>

        <div class="actions">
          <button
            on:click={createGame}
            disabled={creating || activePlayerCount < 2}
            class="create-button"
          >
            {creating ? 'Creating...' : 'Create Game'}
          </button>
          <button on:click={loadPreviewMap} class="regenerate-button">
            Generate New Map
          </button>
        </div>

        {#if error}
          <p class="error">{error}</p>
        {/if}
      </div>

      <div class="map-preview">
        {#if loadingPreview}
          <div class="loading">Generating map...</div>
        {:else if previewRegions.length > 0}
          <GameMap
            regions={previewRegions}
            gameState={null}
            currentPlayer={null}
            onRegionClick={() => {}}
          />
        {:else}
          <div class="no-map">No map available</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>

  .current-player-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .current-player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .player-label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9rem;
  }

  .player-name-display {
    color: white;
    font-weight: 600;
    font-size: 1rem;
  }

  .change-name-button {
    padding: 0.25rem 0.75rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .change-name-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .game-configuration {
    max-width: none; /* Remove max-width constraint */
    margin: 0;
    padding: 20px;
    height: 100vh; /* Full viewport height */
    box-sizing: border-box;
  }

  .name-input-section {
    text-align: center;
    max-width: 400px;
    margin: 0 auto;
  }

  .name-input {
    width: 100%;
    padding: 12px;
    margin: 10px 0;
    border: 2px solid #374151;
    border-radius: 6px;
    font-size: 16px;
    background: #374151;
    color: white;
  }

  .proceed-button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
  }

  .proceed-button:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }

  .configuration-main {
    display: grid;
    grid-template-columns: 400px 1fr; /* Fixed width left panel, flexible right */
    gap: 30px;
    height: calc(100vh - 40px); /* Full height minus padding */
    width: 100%;
  }

  .config-panel {
    background: #1f2937;
    border-radius: 12px;
    padding: 24px;
    overflow-y: auto; /* Allow scrolling if content overflows */
    min-width: 400px; /* Ensure minimum width */
    max-height: 100%; /* Don't exceed container height */
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

  .settings-section, .players-section {
    margin-bottom: 24px;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .setting label {
    font-weight: 500;
    color: #f8fafc;
  }

  .setting select, .number-input {
    padding: 6px 10px;
    border: 1px solid #374151;
    border-radius: 4px;
    background: #374151;
    color: white;
    /* Ensure proper focus states */
    transition: border-color 0.2s ease;
  }

  .setting select:focus, .number-input:focus {
    border-color: #60a5fa;
    outline: none;
  }

  /* Style the dropdown options */
  .setting select option {
    background: #374151;
    color: white;
    padding: 8px;
  }

  /* For better browser compatibility, also style the select when opened */
  .setting select:focus option {
    background: #374151;
    color: white;
  }

  .player-slot {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    padding: 8px;
    background: #374151;
    border-radius: 6px;
  }

  .player-slot select {
    padding: 6px 10px;
    border: 1px solid #475569;
    border-radius: 4px;
    background: #475569;
    color: white;
    font-size: 0.9rem;
    min-width: 80px;
    transition: all 0.2s ease;
  }

  .player-slot select:focus {
    border-color: #60a5fa;
    outline: none;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }

  .player-slot select option {
    background: #475569;
    color: white;
    padding: 8px;
  }

  /* Ensure hover states work properly */
  .player-slot select option:hover {
    background: #60a5fa;
    color: white;
  }

  /* For WebKit browsers (Chrome, Safari) */
  .setting select option:checked,
  .player-slot select option:checked {
    background: #60a5fa;
    color: white;
  }

  .player-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }

  .player-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
  }

  .player-name {
    font-weight: 500;
    color: #f8fafc;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .create-button, .regenerate-button {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .create-button {
    background: #059669;
    color: white;
  }

  .create-button:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }

  .regenerate-button {
    background: #374151;
    color: white;
  }

  .map-preview {
    background: #1f2937;
    border-radius: 12px;
    padding: 24px;
    width: 100%; /* Take full width of grid column */
    height: 100%; /* Take full height of grid row */
    min-height: 500px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .loading, .no-map {
    text-align: center;
    color: #9ca3af;
    padding: 40px;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Ensure the GameMap component fills the available space */
  .map-preview :global(.game-map) {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0; /* Allow flex child to shrink */
  }

  /* Ensure SVG or canvas elements in the map scale properly */
  .map-preview :global(svg),
  .map-preview :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
  }

  .error {
    color: #ef4444;
    margin-top: 10px;
    text-align: center;
  }

  /* Responsive design for mobile */
  @media (max-width: 768px) {
    .game-configuration {
      padding: 10px;
      height: 100vh;
    }

    .configuration-main {
      grid-template-columns: 1fr;
      gap: 20px;
      height: calc(100vh - 20px);
    }

    .config-panel {
      min-width: auto;
      max-height: 40vh; /* Limit height on mobile */
      overflow-y: auto;
    }

    .map-preview {
      height: auto;
      min-height: 60vh; /* Ensure good height for map on mobile */
      flex: 1;
    }
  }

  /* For very large screens */
  @media (min-width: 1400px) {
    .configuration-main {
      grid-template-columns: 450px 1fr; /* Slightly wider config panel */
    }
  }
</style>