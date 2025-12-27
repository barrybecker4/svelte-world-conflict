<script lang="ts">
  import { goto } from '$app/navigation';
  import { AdBanner, GameInstructionsModal } from 'shared-ui';
  import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';
  import Lobby from '$lib/components/lobby/Lobby.svelte';
  import { TUTORIAL_CARDS } from '$lib/game/constants/tutorialContent';
  import { saveGameCreator } from '$lib/client/stores/clientStorage';
  import { GameApiClient } from '$lib/client/gameController/GameApiClient';

  let showInstructions = true;
  let showLobby = false;
  let showConfiguration = false;

  // Ad configuration - use environment variable or default
  $: adUnitId = import.meta.env.VITE_ADSENSE_AD_UNIT_ID || '';
  $: showAds = adUnitId && (showLobby || showConfiguration);

  function handleInstructionsComplete() {
    showInstructions = false;
    showLobby = true;
  }

  async function handleGameCreated(gameConfig: { playerSlots: any[]; settings: any }) {
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
      playerName: player.name,
      isCreator: true
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

<div class="page-container">
  <div class="main-content">
    {#if showInstructions}
      <GameInstructionsModal
        tutorialCards={TUTORIAL_CARDS}
        gameTitle="Galactic Conflict"
        subtitle="A Real-Time Space Strategy Game"
        oncomplete={handleInstructionsComplete}
      />
    {/if}

    {#if showLobby}
      <Lobby on:close={handleLobbyClose} />
    {/if}

    {#if showConfiguration}
      <GameConfiguration
        onclose={handleConfigurationClose}
        ongameCreated={handleGameCreated}
      />
    {/if}
  </div>

  {#if showAds}
    <aside class="ad-sidebar">
      <AdBanner
        adUnitId={adUnitId}
        adFormat="rectangle"
        className="desktop-ad"
      />
    </aside>
    <div class="ad-banner-mobile">
      <AdBanner
        adUnitId={adUnitId}
        adFormat="horizontal"
        className="mobile-ad"
      />
    </div>
  {/if}
</div>

<style>
  .page-container {
    position: relative;
    min-height: 100vh;
  }

  .main-content {
    width: 100%;
  }

  .ad-sidebar {
    position: fixed;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    display: none;
  }

  .ad-banner-mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: none;
    background: rgba(0, 0, 0, 0.8);
    padding: 0.5rem;
    text-align: center;
  }

  @media (min-width: 1024px) {
    .ad-sidebar {
      display: block;
    }
  }

  @media (max-width: 1023px) {
    .ad-banner-mobile {
      display: block;
    }
  }
</style>
