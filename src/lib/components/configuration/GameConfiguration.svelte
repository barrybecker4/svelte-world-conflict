<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import PlayerNameInput from './PlayerNameInput.svelte';
  import PlayerSlots from './PlayerSlots.svelte';
  import GameSettingsPanel from './GameSettingsPanel.svelte';
  import MapPreviewPanel from '$lib/components/map/MapPreviewPanel.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Panel from '$lib/components/ui/Panel.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { loadPlayerName, savePlayerName } from '$lib/client/stores/clientStorage';

  const dispatch = createEventDispatcher();

  let gameSettings = {
    aiDifficulty: 'Nice',
    maxTurns: 10,
    timeLimit: 30,
    mapSize: 'Large'
  };

  let playerName = '';
  let playerSlots = [];

  let creating = false;
  let error = null;
  let showNameInput = true;
  let mapPreviewPanel;

  // Player slot state from PlayerSlotManager
  let activePlayerCount = 0;
  let hasCurrentPlayerSet = false;

  // Determine if create game button should be disabled
  $: createGameDisabled = creating || activePlayerCount < 2 || !hasCurrentPlayerSet;

  // Warning message for create game button
  $: warning = !hasCurrentPlayerSet
    ? 'The game cannot be created until you "set" yourself on one of the player slots'
    : activePlayerCount < 2
    ? 'At least 2 players are required to create a game'
    : '';

  onMount(() => {
    loadStoredPlayerName();
  });

  function loadStoredPlayerName() {
    const storedName = loadPlayerName();
    if (storedName) {
      playerName = storedName;
      showNameInput = false;
    }
  }

  // Handle player name submission from the PlayerNameInput component
  function handleNameSubmitted(event) {
    const { name } = event.detail;
    playerName = name;
    proceedWithName();
  }

  function proceedWithName() {
    if (!playerName) {
      error = 'Please enter a name';
      return;
    }

    savePlayerName(playerName);
    showNameInput = false;
    error = null;
  }

  function changeName() {
    showNameInput = true;
  }

  // Handle updates from PlayerSlots
  function handleSlotsUpdated(event) {
    const { slots, activeSlotCount, hasPlayerSet } = event.detail;
    playerSlots = slots;
    activePlayerCount = activeSlotCount;
    hasCurrentPlayerSet = hasPlayerSet;
  }

  // Handle name changes from PlayerSlots
  function handleNameChange(event) {
    const { name } = event.detail;
    playerName = name;
    savePlayerName(name);
  }

  // Reactive statement to refresh map preview when map size changes
  $: if (mapPreviewPanel && gameSettings.mapSize) {
    mapPreviewPanel.refreshPreview();
  }

  async function createGame() {
    if (creating) return;

    // Additional validation before proceeding
    if (!hasCurrentPlayerSet) {
      error = 'You must "set" yourself on one of the player slots before creating the game.';
      return;
    }

    creating = true;
    error = null;

    try {
      verifyMapPreview();
      const gameConfig = buildGameConfig();
      dispatch('gameCreated', gameConfig);
    } catch (err) {
      error = err.message;
    } finally {
      creating = false;
    }
  }

  function buildGameConfig() {
    const currentPreviewRegions = mapPreviewPanel?.getCurrentPreviewRegions();
    const currentPreviewState = mapPreviewPanel?.getCurrentPreviewState();

    if (!currentPreviewRegions || currentPreviewRegions.length === 0) {
      throw new Error('No map preview available. Please wait for map to load.');
    }

    const updatedPlayerSlots = playerSlots.map(slot => ({
      ...slot,
      name: slot.type === 'Set' ? slot.customName : slot.defaultName,
    }));

    return {
      settings: gameSettings,
      playerSlots: updatedPlayerSlots,
      selectedMapRegions: currentPreviewRegions.map(region => region.toJSON ? region.toJSON() : region),
      selectedMapState: currentPreviewState
    };
  }

  function verifyMapPreview() {
    if (!mapPreviewPanel?.hasValidPreview()) {
       throw new Error('Map preview is not ready. Please wait or click "New Map" to generate one.');
    }
  }
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
        <Section title="Player {playerName} Setup" borderBottom={true} padding="12px">
        </Section>

        <PlayerSlots
          bind:slots={playerSlots}
          bind:playerName={playerName}
          on:update={handleSlotsUpdated}
          on:nameChange={handleNameChange}
        />

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
            disabled={createGameDisabled}
            loading={creating}
            on:click={createGame}
            title={warning}
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

  .error-message {
    color: var(--color-red-400, #f87171);
    font-size: var(--text-sm, 0.875rem);
    margin-bottom: var(--space-3, 12px);
    padding: var(--space-2, 8px);
    background: rgba(248, 113, 113, 0.1);
    border-radius: var(--border-radius-md, 6px);
    border-left: 3px solid var(--color-red-400, #f87171);
  }

  /* Target the last section's content specifically for button centering */
  :global(.config-panel .section-base:last-child .section-content) {
    display: flex;
    justify-content: center;
  }
</style>
