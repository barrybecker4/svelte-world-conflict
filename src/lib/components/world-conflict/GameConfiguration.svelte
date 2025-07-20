<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import GameMap from './GameMap.svelte';
  import { MapGenerator } from '$lib/game/data/MapGenerator';

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

  // Load preview map locally using MapGenerator
  function loadPreviewMap() {
    loadingPreview = true;
    try {
      // Generate map using the utility
      previewRegions = mapGenerator.generateMap({
        size: gameSettings.mapSize,
        lakePercentage: 0.05 // 5% of regions become lakes
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
    forceRandomizeAssignments(); // Regenerate assignments when player config changes
  }

  function getSlotDisplayName(slot) {
    if (slot.type === 'Set' && slot.customName) {
      return slot.customName;
    }
    return slot.defaultName;
  }

  function getSlotStatusText(slot) {
    switch (slot.type) {
      case 'Off': return 'Off';
      case 'Set': return 'Set';
      case 'Open': return 'Open';
      case 'AI': return 'AI';
      default: return 'Off';
    }
  }

  function getActivePlayerCount() {
    return playerSlots.filter(slot => slot.type !== 'Off').length;
  }

  function canStartGame() {
    const activeCount = getActivePlayerCount();
    const hasSetPlayer = playerSlots.some(slot => slot.type === 'Set');
    return activeCount >= 2 && hasSetPlayer && !creating;
  }

  function updateMapSize(size) {
    gameSettings.mapSize = size;
    // loadPreviewMap() will be called automatically by the reactive statement
  }

  // Generate preview regions when map size changes
  $: {
    if (gameSettings.mapSize) {
      loadPreviewMap();
    }
  }

  // Force truly random assignment of home regions
  let randomAssignmentKey = 0;

  function forceRandomizeAssignments() {
    randomAssignmentKey = Math.random();
  }

  // Get home regions for preview (each active player gets 1 UNIQUE random home region)
  $: playerHomeRegions = (() => {
    const activePlayers = playerSlots.filter(p => p.type !== 'Off');
    const homeRegions = {};

    if (previewRegions.length === 0 || activePlayers.length === 0) {
      return homeRegions;
    }

    // Force recalculation when key changes
    const _ = randomAssignmentKey;

    // Create array of ALL region indices
    const allRegionIndices = Array.from({length: previewRegions.length}, (_, i) => i);

    // Shuffle the array to randomize
    const randomSeed = Date.now() + Math.random() * 1000000;
    for (let i = allRegionIndices.length - 1; i > 0; i--) {
      const j = Math.floor((Math.sin(randomSeed + i) * 10000 % 1) * (i + 1));
      [allRegionIndices[i], allRegionIndices[j]] = [allRegionIndices[j], allRegionIndices[i]];
    }

    // Assign UNIQUE regions to each player (take from shuffled array)
    activePlayers.forEach((player, index) => {
      if (index < allRegionIndices.length) {
        const assignedRegion = allRegionIndices[index]; // Take next unique region
        homeRegions[player.index] = [assignedRegion];
        console.log(`🏠 Player ${player.name} (${player.index}) assigned to UNIQUE region ${assignedRegion}`);
      }
    });

    // Verify no duplicates
    const assignedRegionsList = Object.values(homeRegions).flat();
    const uniqueRegions = [...new Set(assignedRegionsList)];
    if (assignedRegionsList.length !== uniqueRegions.length) {
      console.error('❌ DUPLICATE REGION ASSIGNMENT DETECTED!', homeRegions);
    } else {
      console.log('✅ All players have unique home regions:', homeRegions);
    }

    return homeRegions;
  })();

  // Create game state for preview that updates when player slots change
  $: previewGameState = {
    owners: Object.fromEntries(
      Object.entries(playerHomeRegions).flatMap(([playerIndex, regionIndices]) =>
        regionIndices.map(regionIndex => [regionIndex, parseInt(playerIndex)])
      )
    ),
    soldiersByRegion: Object.fromEntries(
      Object.values(playerHomeRegions).flat().map(regionIndex => [regionIndex, [{}, {}, {}]]) // 3 soldiers
    ),
    players: playerSlots.filter(p => p.type !== 'Off').map(p => ({
      index: p.index,
      name: getSlotDisplayName(p)
    }))
  };

  async function startGame() {
    if (!canStartGame()) return;

    creating = true;
    error = null;

    try {
      // Convert the player setup
      const activePlayers = playerSlots
        .filter(slot => slot.type !== 'Off')
        .map(slot => ({
          name: getSlotDisplayName(slot),
          type: slot.type,
          index: slot.index,
          isAI: slot.type === 'AI'
        }));

      const response = await fetch('/api/game/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players: activePlayers,
          settings: gameSettings,
          regions: previewRegions
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Store player info
        const humanPlayer = activePlayers.find(p => p.type === 'Set');
        localStorage.setItem(`wc_game_${result.gameId}`, JSON.stringify({
          playerId: result.playerId,
          playerIndex: humanPlayer.index,
          playerName: humanPlayer.name
        }));

        // Navigate to game
        window.location.href = `/game/${result.gameId}`;
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Failed to create game';
      }
    } catch (err) {
      error = 'Network error: ' + err.message;
    } finally {
      creating = false;
    }
  }

  function cancel() {
    dispatch('close');
  }

  function goBack() {
    showNameInput = true;
    playerSlots = playerSlots.map(slot => ({ ...slot, type: 'Off', customName: '' }));
    error = null;
  }

  // Load initial preview map
  onMount(() => {
    loadPreviewMap();
  });
</script>

<!-- Full screen game configuration -->
<div class="config-overlay">
  <div class="config-container">
    {#if showNameInput}
      <!-- Name Input Screen -->
      <div class="name-input-screen">
        <div class="name-input-content">
          <h1>Enter Your Name</h1>
          <p class="subtitle">Choose a name for the battlefield</p>

          {#if error}
            <div class="error-message">⚠️ {error}</div>
          {/if}

          <div class="name-input-form">
            <input
              type="text"
              bind:value={playerName}
              placeholder="Enter your name..."
              maxlength="20"
              class="name-input"
              on:keydown={(e) => e.key === 'Enter' && proceedWithName()}
              autofocus
            />

            <div class="name-buttons">
              <button on:click={cancel} class="cancel-btn">Cancel</button>
              <button on:click={proceedWithName} class="proceed-btn" disabled={!playerName.trim()}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <!-- Game Configuration Screen -->
      <div class="config-header">
        <h1>Player {playerName} Setup
          <br/>
          <span class="title-subheader">
            Configure your World Conflict battle
          </span>
        </h1>
      </div>

      <div class="config-content">
        <!-- Left panel: Player and game configuration -->
        <div class="player-panel">
          <h3>Players ({getActivePlayerCount()}/4)</h3>

          {#if error}
            <div class="error-message">⚠️ {error}</div>
          {/if}

          <div class="player-slots">
            {#each playerSlots as slot, index}
              <div class="player-slot" class:active={slot.type !== 'Off'}>
                <div class="player-info">
                  <div
                    class="player-color"
                    style="background: linear-gradient(135deg, {slot.colorStart}, {slot.colorEnd})"
                  ></div>
                  <div class="player-details">
                    <div class="player-name">{getSlotDisplayName(slot)}</div>
                    <div class="player-status">{getSlotStatusText(slot)}</div>
                  </div>
                </div>

                <select
                  class="slot-selector"
                  value={slot.type}
                  on:change={(e) => changeSlotType(index, e.target.value)}
                >
                  {#each slotTypes as type}
                    <option value={type}>{type}</option>
                  {/each}
                </select>
              </div>
            {/each}
          </div>

          <!-- AI Difficulty -->
          <div class="setting-group">
            <label>AI</label>
            <div class="button-group">
              {#each ['Nice', 'Rude', 'Mean', 'Evil'] as level}
                <button
                  class="setting-btn"
                  class:active={gameSettings.aiDifficulty === level}
                  on:click={() => gameSettings.aiDifficulty = level}
                >
                  {level}
                </button>
              {/each}
            </div>
          </div>

          <!-- Turns -->
          <div class="setting-group">
            <label>Turns</label>
            <div class="button-group">
              {#each [3, 10, 15, 'Endless'] as turn}
                <button
                  class="setting-btn"
                  class:active={gameSettings.turns === turn}
                  on:click={() => gameSettings.turns = turn}
                >
                  {turn}
                </button>
              {/each}
            </div>
          </div>

          <!-- Time -->
          <div class="setting-group">
            <label>Time (sec)</label>
            <div class="button-group">
              {#each [10, 30, 60, 'Unlimited'] as time}
                <button
                  class="setting-btn"
                  class:active={gameSettings.timeLimit === time}
                  on:click={() => gameSettings.timeLimit = time}
                >
                  {time}
                </button>
              {/each}
            </div>
          </div>

          <!-- Map Size -->
          <div class="setting-group">
            <label>Map size</label>
            <div class="button-group">
              {#each ['Small', 'Medium', 'Large'] as size}
                <button
                  class="setting-btn"
                  class:active={gameSettings.mapSize === size}
                  on:click={() => updateMapSize(size)}
                >
                  {size}
                </button>
              {/each}
            </div>
          </div>

          <!-- Action buttons -->
          <div class="action-buttons">
            <button on:click={goBack} class="secondary-btn">
              Change Name
            </button>
            <button
              on:click={() => { loadPreviewMap(); forceRandomizeAssignments(); }}
              class="secondary-btn"
              disabled={creating || loadingPreview}
            >
              {loadingPreview ? 'Loading...' : 'Change map'}
            </button>
            <button
              on:click={startGame}
              class="primary-btn"
              disabled={!canStartGame()}
            >
              {creating ? 'Starting...' : 'Done configuring'}
            </button>
          </div>
        </div>

        <!-- Right panel: Map preview -->
        <div class="map-panel">
          <h3>Map Preview ({previewRegions.length} regions)</h3>
          <div class="map-preview">
            {#if loadingPreview}
              <div class="loading-indicator">
                <div class="spinner"></div>
                <p>Loading map...</p>
              </div>
            {:else if previewRegions.length > 0}
              <GameMap
                regions={previewRegions}
                gameState={previewGameState}
                onRegionClick={() => {}}
              />
            {:else}
              <div class="no-map">
                <p>No map data available</p>
              </div>
            {/if}
          </div>

          <!-- Map info -->
          <div class="map-info">
            <div>Size: {gameSettings.mapSize}</div>
            <div>Regions: {previewRegions.length}</div>
            <div>Players: {getActivePlayerCount()}</div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .config-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%);
    z-index: 1000;
    overflow: auto;
  }

  .config-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', monospace;
  }

  /* Name Input Screen */
  .name-input-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .name-input-content {
    text-align: center;
    background: rgba(15, 23, 42, 0.9);
    border: 2px solid #475569;
    border-radius: 12px;
    padding: 3rem;
    max-width: 500px;
    width: 100%;
  }

  .name-input-content h1 {
    color: #f8fafc;
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #94a3b8;
    margin-bottom: 2rem;
  }

  .name-input-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .name-input {
    background: rgba(30, 41, 59, 0.8);
    border: 2px solid #475569;
    border-radius: 8px;
    padding: 1rem;
    color: #f8fafc;
    font-size: 1.1rem;
    text-align: center;
  }

  .name-input:focus {
    border-color: #60a5fa;
    outline: none;
  }

  .name-buttons {
    display: flex;
    gap: 1rem;
  }

  .cancel-btn, .proceed-btn {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: #374151;
    color: #f9fafb;
  }

  .cancel-btn:hover {
    background: #4b5563;
  }

  .proceed-btn {
    background: #059669;
    color: white;
  }

  .proceed-btn:hover:not(:disabled) {
    background: #047857;
  }

  .proceed-btn:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }

  /* Game Configuration Screen */
  .config-header {
    text-align: center;
    padding: 2rem 2rem 0;
    color: #f8fafc;
  }

  .config-header h1 {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .title-subheader {
    font-size: 1.1rem;
    color: #94a3b8;
    font-weight: normal;
  }

  .config-content {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 2rem;
    background: rgba(15, 23, 42, 0.8);
    border: 2px solid #475569;
    border-radius: 12px;
    padding: 2rem;
    margin: 2rem;
    backdrop-filter: blur(10px);
    flex: 1;
    overflow-y: auto;
  }

  .player-panel h3,
  .map-panel h3 {
    margin-bottom: 1rem;
    color: #f8fafc;
    font-size: 1.2rem;
    border-bottom: 1px solid #475569;
    padding-bottom: 0.5rem;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
    color: #fecaca;
    font-size: 0.9rem;
  }

  .player-slots {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .player-slot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 0.75rem;
    transition: all 0.2s;
  }

  .player-slot.active {
    border-color: #60a5fa;
    background: rgba(30, 41, 59, 0.8);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .player-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
  }

  .player-details {
    flex: 1;
  }

  .player-name {
    font-weight: 600;
    color: #f8fafc;
    font-size: 0.95rem;
  }

  .player-status {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .slot-selector {
    background: #374151;
    color: white;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .slot-selector:focus {
    border-color: #60a5fa;
    outline: none;
  }

  .setting-group {
    margin-bottom: 1rem;
  }

  .setting-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }

  .button-group {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .setting-btn {
    background: #374151;
    color: #f9fafb;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .setting-btn.active {
    background: #2563eb;
    border-color: #2563eb;
  }

  .setting-btn:hover {
    background: #4b5563;
  }

  .setting-btn.active:hover {
    background: #1d4ed8;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  .primary-btn, .secondary-btn {
    padding: 0.75rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .primary-btn {
    background: #059669;
    color: white;
  }

  .primary-btn:hover:not(:disabled) {
    background: #047857;
  }

  .primary-btn:disabled {
    background: #6b7280;
    cursor: not-allowed;
  }

  .secondary-btn {
    background: #374151;
    color: #f9fafb;
  }

  .secondary-btn:hover {
    background: #4b5563;
  }

  .map-panel {
    display: flex;
    flex-direction: column;
  }

  .map-preview {
    flex: 1;
    border: 1px solid #475569;
    border-radius: 8px;
    overflow: hidden;
    background: #1e3a8a;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-indicator, .no-map {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #374151;
    border-top: 3px solid #60a5fa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .map-info {
    margin-top: 1rem;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.85rem;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
</style>
