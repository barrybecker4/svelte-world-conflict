<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import GameMap from '$lib/components/map/GameMap.svelte';
  import PlayerNameInput from './PlayerNameInput.svelte';
  import PlayerConfiguration from './PlayerConfiguration.svelte';
  import GameSettingsPanel from './GameSettingsPanel.svelte';
  import MapPreviewPanel from '$lib/components/map/MapPreviewPanel.svelte';
  import { getPlayerConfig } from '$lib/game/constants/playerConfigs';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

  const dispatch = createEventDispatcher();

  let gameSettings = {
    aiDifficulty: 'Nice',
    maxTurns: 10,
    timeLimit: 30,
    mapSize: 'Large'
  };

  let playerName = '';
  const PLAYER_NAME_KEY = 'wc_player_name';

  // Player slot states - Off/Set/Open/AI as per original
  let playerSlots = [...Array(GAME_CONSTANTS.MAX_PLAYERS).keys()]
    .map(index => ({ ...getPlayerConfig(index), type: 'Off', customName: '' }));

  let creating = false;
  let error = null;
  let showNameInput = true;
  let mapPreviewPanel;

  // Count active players for map generation
  $: activePlayerCount = playerSlots.filter(slot => slot.type !== 'Off').length;

  function loadStoredPlayerName() {
    const storedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (storedName && storedName.trim()) {
      playerName = storedName.trim();
      showNameInput = false;
      return true;
    }
    return false;
  }

  function savePlayerName(name) {
      localStorage.setItem(PLAYER_NAME_KEY, name.trim());
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

    // Handle player switching
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

    creating = true;
    error = null;
    verifyMapPreview();

    const activePlayers = playerSlots.filter(slot => slot.type !== 'Off');
    if (activePlayers.length < 2) {
      throw new Error('At least 2 players are required');
    }

    const currentPreviewRegions = mapPreviewPanel?.getCurrentPreviewRegions();
    const currentPreviewState = mapPreviewPanel?.getCurrentPreviewState();

    if (!currentPreviewRegions || currentPreviewRegions.length === 0) {
      throw new Error('No map preview available. Please wait for map to load.');
    }

    const updatedPlayerSlots = playerSlots.map(slot => ({
      ...slot,
      name: slot.type === 'Set' ? slot.customName : slot.defaultName,
    }));

    // Build the game configuration WITH the selected map
    const gameConfig = {
      settings: gameSettings,
      playerSlots: updatedPlayerSlots,
      selectedMapRegions: currentPreviewRegions.map(region => region.toJSON ? region.toJSON() : region),
      selectedMapState: currentPreviewState
    };

    dispatch('gameCreated', gameConfig); // Dispatch to parent
    creating = false;
  }

  function verifyMapPreview() {
    if (!mapPreviewPanel?.hasValidPreview()) {
       throw new Error('Map preview is not ready. Please wait or click "New Map" to generate one.');
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
      <!-- Left Panel: Configuration -->
      <Panel variant="dark" blur={true} customClass="config-panel">

        <Section title="Game Setup" borderBottom={true}>
        </Section>

        <Section title="Current Player" customClass="current-player-section">
          <div class="current-player">
            <span class="player-label">Playing as:</span>
            <span class="player-name-display">{playerName}</span>
            <Button variant="ghost" size="sm" on:click={changeName}>
              Change
            </Button>
          </div>
        </Section>

        <Section title="Players">
          {#each playerSlots as slot, index}
            <PlayerConfiguration
              playerSlot={slot}
              {index}
              on:slotUpdated={handleSlotUpdated}
            />
          {/each}
        </Section>

        <Section title="" borderBottom={true}>
          <GameSettingsPanel bind:gameSettings />
        </Section>

        <Section title="" borderBottom={false}>
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
        </Section>

      </Panel>

      <!-- Right Panel: Map Preview -->
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
  /* Main container - only component-specific styling */
  .game-configuration {
    min-height: 100vh;
    background: linear-gradient(135deg, var(--color-gray-800, #1e293b) 0%, var(--color-gray-700, #334155) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5, 20px);
  }

  .name-input-container {
    /* PlayerNameInput handles its own styling */
  }

  .configuration-main {
    display: flex;
    gap: var(--space-8, 32px);
    width: 100%;
    height: 80vh;
    min-height: 600px;
  }

  :global(.config-panel) {
    overflow-y: auto;
    min-width: 400px;
    max-height: 100%;
    flex-direction: column;
    display: flex;
  }

  /* Current player section styling */
  .current-player {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
  }

  .player-label {
    font-weight: var(--font-medium, 500);
    color: var(--text-tertiary, #94a3b8);
  }

  .player-name-display {
    font-weight: var(--font-semibold, 600);
    color: var(--text-primary, #f8fafc);
    font-size: var(--text-lg, 1.1rem);
  }

  /* Error message */
  .error-message {
    color: var(--color-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-error, #ef4444);
    border-radius: var(--radius-sm, 4px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    margin-bottom: var(--space-3, 12px);
    font-size: var(--text-sm, 0.9rem);
  }

  /* Button styling */
  :global(.config-panel .btn-lg) {
    width: 100%;
  }
</style>