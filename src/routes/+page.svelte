<script>
  import { onMount } from 'svelte';
  import GameInstructions from '$lib/components/world-conflict/GameInstructions.svelte';
  import GameLobby from '$lib/components/world-conflict/GameLobby.svelte';
  import GameConfiguration from '$lib/components/world-conflict/GameConfiguration.svelte';

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
  <GameConfiguration on:close={handleConfigurationClose} />
{/if}
