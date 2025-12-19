<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';
  import Lobby from '$lib/components/lobby/Lobby.svelte';
  import GameInstructionsModal from '$lib/components/modals/GameInstructionsModal.svelte';
  import { saveGameCreator } from '$lib/client/stores/clientStorage';
  import { GameApiClient } from '$lib/client/gameController/GameApiClient';

  let showInstructions = true;
  let showLobby = false;
  let showConfiguration = false;

  function handleInstructionsComplete() {
    showInstructions = false;
    showLobby = true;
  }

  async function handleGameCreated(event: CustomEvent) {
    const gameConfig = event.detail;
    const humanPlayer = extractHumanPlayer(gameConfig);

    const result = await GameApiClient.createGame({
      playerName: humanPlayer.name,
      gameType: 'MULTIPLAYER',
      armadaSpeed: gameConfig.settings.armadaSpeed,
      gameDuration: gameConfig.settings.gameDuration,
      playerSlots: gameConfig.playerSlots,
      settings: gameConfig.settings
    });

    const player = result.player || { slotIndex: 0, name: humanPlayer.name };

    saveGameCreator(result.gameId, {
      playerId: player.slotIndex.toString(),
      playerSlotIndex: player.slotIndex,
      playerName: player.name
    });

    await goto(`/game/${result.gameId}`);
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
    showConfiguration = true;
  }

  function handleConfigurationClose() {
    showConfiguration = false;
    showLobby = true;
  }
</script>

{#if showInstructions}
  <GameInstructionsModal oncomplete={handleInstructionsComplete} />
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

