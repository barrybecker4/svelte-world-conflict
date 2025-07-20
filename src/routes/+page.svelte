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
    // Instructions will show immediately
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

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
  <div class="max-w-4xl mx-auto px-6 py-12 text-center">
    <!-- Main Title -->
    <div class="mb-12">
      <h1 class="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
        World Conflict
      </h1>
      <p class="text-xl md:text-2xl text-gray-300 mb-2">
        A multiplayer strategy game inspired by Risk
      </p>
      <div class="text-sm text-gray-400 space-x-4">
        <span>Version: 2.0.0</span>
        <span>•</span>
        <span>Up to 4 Players</span>
        <span>•</span>
        <a
          href="https://github.com/barrybecker4/world-conflict/wiki/World-Conflict"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-400 hover:text-blue-300 transition-colors"
        >
          Credits
        </a>
      </div>
    </div>

    <!-- Game Preview/Map Placeholder -->
    <div class="bg-gray-800/50 rounded-xl border border-gray-700 p-8 mb-12 backdrop-blur-sm">
      <div class="aspect-video bg-gradient-to-br from-green-800 via-brown-600 to-blue-800 rounded-lg flex items-center justify-center border-2 border-gray-600">
        <div class="text-center">
          <div class="text-4xl mb-2">🗺️</div>
          <p class="text-gray-300">World Map</p>
          <p class="text-gray-500 text-sm">Coming Soon</p>
        </div>
      </div>
    </div>

    <!-- Content based on state -->
    {#if loading}
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-gray-300">Checking for available games...</p>
      </div>
    {:else if !showInstructions && !showLobby && !showConfiguration}
      <div class="text-center">
        <p class="text-gray-300 mb-4">Welcome to World Conflict!</p>
        <p class="text-gray-400 text-sm">Preparing your strategic experience...</p>
      </div>
    {/if}

    <!-- Features Grid -->
    <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
        <div class="text-3xl mb-3">⚔️</div>
        <h3 class="text-lg font-semibold mb-2">Strategic Combat</h3>
        <p class="text-gray-400 text-sm">
          Command armies and conquer territories in epic battles
        </p>
      </div>

      <div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
        <div class="text-3xl mb-3">🌐</div>
        <h3 class="text-lg font-semibold mb-2">Real-time Multiplayer</h3>
        <p class="text-gray-400 text-sm">
          Play with friends instantly with WebSocket updates
        </p>
      </div>

      <div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700">
        <div class="text-3xl mb-3">🤖</div>
        <h3 class="text-lg font-semibold mb-2">AI Opponents</h3>
        <p class="text-gray-400 text-sm">
          Challenge intelligent AI with different personalities
        </p>
      </div>
    </div>

    <!-- Status Indicator -->
    <div class="mt-12 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
      <p class="text-yellow-300">
        🚧 <strong>In Development:</strong> This is the new SvelteKit + Cloudflare version of World Conflict
      </p>
    </div>
  </div>
</div>

<!-- Instructions Modal - Shows automatically on load -->
{#if showInstructions}
  <GameInstructions on:complete={handleInstructionsComplete} />
{/if}

<!-- Game Lobby - Shows if open games exist -->
{#if showLobby}
  <GameLobby gameMode="join" on:close={handleLobbyClose} />
{/if}

<!-- Game Configuration - Shows when creating new game -->
{#if showConfiguration}
  <GameConfiguration on:close={handleConfigurationClose} />
{/if}
