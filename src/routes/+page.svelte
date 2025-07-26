<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import GameInstructions from '$lib/components/GameInstructions.svelte';
  import GameLobby from '$lib/components/GameLobby.svelte';
  import GameConfiguration from '$lib/components/configuration/GameConfiguration.svelte';

  let showInstructions = true; // Auto-show on load
  let showLobby = false;
  let showConfiguration = false;
  let hasOpenGames = false;
  let loading = false;

  onMount(() => {
    console.log('📖 Auto-showing instructions on page load');
  });

  async function handleInstructionsComplete() {
    console.log('✅ Instructions complete - checking for open games');
    showInstructions = false;
    loading = true;

    try {
      // Check if there are any open games
      const response = await fetch('/api/games/open');
      if (response.ok) {
        const openGames = await response.json();
        hasOpenGames = openGames.length > 0;

        if (hasOpenGames) {
          console.log(`🎮 Found ${openGames.length} open games - showing lobby`);
          showLobby = true;
        } else {
          console.log('🆕 No open games - showing game configuration');
          showConfiguration = true;
        }
      } else {
        console.log('🆕 API error - showing game configuration');
        showConfiguration = true;
      }
    } catch (error) {
      console.log('🆕 Network error - showing game configuration');
      showConfiguration = true;
    } finally {
      loading = false;
    }
  }

  async function handleGameCreated(event) {
    const gameConfig = event.detail;
    console.log('🎮 Game created with config:', gameConfig);

    try {
      // Extract the human player name from playerSlots
      const humanPlayer = gameConfig.playerSlots.find(slot => slot.type === 'Set');
      if (!humanPlayer) {
        throw new Error('No human player found in game configuration');
      }

      console.log('📡 Creating World Conflict game...');

      // Call the API with the FULL player configuration
      const response = await fetch('/api/game/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: humanPlayer.name,
          mapSize: gameConfig.settings.mapSize,
          aiDifficulty: gameConfig.settings.aiDifficulty,
          turns: gameConfig.settings.turns,
          timeLimit: gameConfig.settings.timeLimit,
          playerSlots: gameConfig.playerSlots
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Game created successfully:', result);

        // Store player info in localStorage for the game page to load
        localStorage.setItem(`wc_game_${result.gameId}`, JSON.stringify({
          gameId: result.gameId,
          playerId: result.playerId,
          playerIndex: result.playerIndex || 0,
          playerName: humanPlayer.name
        }));

        console.log('🎯 Navigating to game:', result.gameId);

        // Navigate to the game page!
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

  function handleLobbyClose() {
    showLobby = false;
    showConfiguration = true; // Go to game configuration instead of buttons
  }

  function handleConfigurationClose() {
    showConfiguration = false;
    showInstructions = true; // Back to instructions
  }
</script>

{#if showInstructions}
  <GameInstructions on:complete={handleInstructionsComplete} />
{/if}

{#if showLobby}
  <GameLobby gameMode="join" on:close={handleLobbyClose} />
{/if}

{#if showConfiguration}
  <GameConfiguration
    on:close={handleConfigurationClose}
    on:gameCreated={handleGameCreated}
  />
{/if}
