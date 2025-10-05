<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GameInstructions from '$lib/components/modals/GameInstructionsModal.svelte';
  import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';
  import Lobby from '$lib/components/lobby/Lobby.svelte';
  import { useAudio } from '$lib/client/audio/useAudio';
  import { audioSystem } from '$lib/client/audio/AudioSystem';
  import { SOUNDS } from '$lib/client/audio/sounds';
  import { saveGameCreator } from '$lib/client/stores/clientStorage';

  let showInstructions = true; // Auto-show on load
  let showLobby = false;
  let showConfiguration = false;
  let loading = false;

  const { initializeAudio } = useAudio();

  onMount(async () => {
    await initializeAudio();
  });

  function handleInstructionsComplete() {
    showInstructions = false;
    showLobby = true;
  }

  async function handleGameCreated(event: CustomEvent) {
    const gameConfig = event.detail;
    const humanPlayer = extractHumanPlayer(gameConfig);

    const response = await createNewGame(gameConfig, humanPlayer);

    if (response.ok) {
      const result = await response.json();
      const player = result.player || { index: 0, name: humanPlayer.name };

      await audioSystem.playSound(SOUNDS.GAME_CREATED);

      saveGameCreator(result.gameId, {
        playerId: player.slotIndex.toString(),  // Use player slot index as string
        playerSlotIndex: player.slotIndex,
        playerName: player.name
      });

      // Navigate to game - will show WaitingRoom for PENDING games, WorldConflictGame for ACTIVE games
      await goto(`/game/${result.gameId}`);

    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
  }

  async function createNewGame(gameConfig: any, humanPlayer: any) {
    return await fetch('/api/game/new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        playerName: humanPlayer.name,
        gameType: 'MULTIPLAYER', // Always create as multiplayer
        mapSize: gameConfig.settings.mapSize,
        aiDifficulty: gameConfig.settings.aiDifficulty,
        maxTurns: gameConfig.settings.maxTurns,
        timeLimit: gameConfig.settings.timeLimit,
        playerSlots: gameConfig.playerSlots,
        selectedMapRegions: gameConfig.selectedMapRegions,
        selectedMapState: gameConfig.selectedMapState,
        settings: gameConfig.settings
      })
    });
  }

  function extractHumanPlayer(gameConfig: any) {
    const humanPlayer = gameConfig.playerSlots.find((slot: any) => slot.type === 'Set');
    if (!humanPlayer) {
      throw new Error('No human player found in game configuration');
    }
    return humanPlayer;
  }

  function handleLobbyClose() {
    showLobby = false;
    showConfiguration = true; // Go to game configuration when "New Game" is clicked
  }

  function handleConfigurationClose() {
    showConfiguration = false;
    showLobby = true; // Go back to lobby instead of instructions
  }
</script>

{#if showInstructions}
  <GameInstructions on:complete={handleInstructionsComplete} />
{/if}

{#if showLobby}
  <Lobby on:close={handleLobbyClose} />
{/if}

{#if showConfiguration}
  <GameConfiguration
    on:close={handleConfigurationClose}
    on:gameCreated={handleGameCreated}
  />
{/if}
