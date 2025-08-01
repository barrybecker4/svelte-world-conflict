<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GameInstructions from '$lib/components/GameInstructions.svelte';
  import Lobby from '$lib/components/Lobby.svelte';
  import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';

  let showInstructions = true; // Auto-show on load
  let showLobby = false;
  let showConfiguration = false;
  let loading = false;

  onMount(() => {
    console.log('📖 Showing instructions on page load');
  });

  async function handleInstructionsComplete() {
    console.log('✅ Instructions complete - showing lobby');
    showInstructions = false;
    loading = true;

    try {
      // Always show the lobby first instead of checking for games
      console.log('🏛️ Showing lobby for game selection');
      showLobby = true;
    } catch (error) {
      console.log('🆕 Error - showing game configuration as fallback');
      showConfiguration = true;
    } finally {
      loading = false;
    }
  }

  async function handleGameCreated(event) {
    const gameConfig = event.detail;
    console.log('🎮 Game created with config:', gameConfig);

    try {
      const humanPlayer = extractHumanPlayer(gameConfig);
      console.log('📡 Creating World Conflict game...');

      const response = await createNewGame(gameConfig, humanPlayer);

      if (response.ok) {
        const result = await response.json();

        // Find the human player in the result
        const player = result.player || { index: 0, name: humanPlayer.name };

        localStorage.setItem(`wc_game_${result.gameId}`, JSON.stringify({
          gameId: result.gameId,
          playerId: player.index.toString(),  // Use player index as string
          playerIndex: player.index,
          playerName: player.name
        }));

        // Navigate to game - will show WaitingRoom for PENDING games, WorldConflictGame for ACTIVE games
        await goto(`/game/${result.gameId}`);

      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      console.error('❌ Failed to create game:', error);
      alert(`Failed to create game: ${error.message}`);
    }
  }

  async function createNewGame(gameConfig, humanPlayer) {
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
        turns: gameConfig.settings.turns,
        timeLimit: gameConfig.settings.timeLimit,
        playerSlots: gameConfig.playerSlots
      })
    });
  }

  function extractHumanPlayer(gameConfig) {
    const humanPlayer = gameConfig.playerSlots.find(slot => slot.type === 'Set');
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
  <Lobby gameMode="join" on:close={handleLobbyClose} />
{/if}

{#if showConfiguration}
  <GameConfiguration
    on:close={handleConfigurationClose}
    on:gameCreated={handleGameCreated}
  />
{/if}
