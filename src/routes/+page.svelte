<script>
  function handleStartGame() {
    alert('Game setup coming soon!');
  }

  function handleJoinGame() {
    alert('Join game feature coming soon!');
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

    <!-- Action Buttons -->
    <div class="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
      <button
        class="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold text-lg transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
        on:click={handleStartGame}
      >
        Start New Game
      </button>

      <button
        class="w-full sm:w-auto px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-lg transition-all duration-200 border border-gray-600"
        on:click={handleJoinGame}
      >
        Join Game
      </button>
    </div>

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
