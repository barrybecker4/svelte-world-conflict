<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import GameMap from './GameMap.svelte';
  import { MapGenerator } from '$lib/game/data/map/MapGenerator';

  const dispatch = createEventDispatcher();

  // Fixed player configurations matching original
  const PLAYER_CONFIGS = [
    {
      index: 0,
      defaultName: 'barrybecker4',
      colorStart: '#dc2626',
      colorEnd: '#991b1b'
    },
    {
      index: 1,
      defaultName: 'Crimson',
      colorStart: '#2563eb',
      colorEnd: '#1d4ed8'
    },
    {
      index: 2,
      defaultName: 'Purple',
      colorStart: '#8A2BE2',
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

  function proceedWithName() {
    if (!playerName.trim()) {
      error = 'Please enter your name';
      return;
    }

    // Set the first player slot to "Set" with the custom name
    playerSlots[0] = {
      ...playerSlots[0],
      type: 'Set',
      customName: playerName.trim()
    };
    playerSlots = [...playerSlots];

    showNameInput = false;
    error = null;
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

    dispatch('gameCreated', gameConfig);
  }

  // Load initial preview when component mounts
  onMount(() => {
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

        <!-- Game Settings -->
        <div class="settings-section">
          <h3>Game Settings</h3>

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

        <!-- Player Slots -->
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

      <!-- Map Preview -->
      <div class="map-preview">
        <h3>Map Preview</h3>
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
  .game-configuration {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
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
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  .config-panel {
    background: #1f2937;
    border-radius: 12px;
    padding: 24px;
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
  }

  .setting select, .number-input {
    padding: 6px 10px;
    border: 1px solid #374151;
    border-radius: 4px;
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
  }

  .loading, .no-map {
    text-align: center;
    color: #9ca3af;
    padding: 40px;
  }

  .error {
    color: #ef4444;
    margin-top: 10px;
    text-align: center;
  }

  @media (max-width: 768px) {
    .configuration-main {
      grid-template-columns: 1fr;
    }
  }
</style>
