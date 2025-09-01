<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { multiplayerActions, multiplayerState, gameUpdates } from '$lib/game/stores/multiplayerStore.js';

  let testGameId = 'test-game-123';
  let messages = [];
  let messageToSend = '';
  let connectionLogs: string[] = [];

  // Reactive state from store
  $: currentState = $multiplayerState;
  $: latestUpdate = $gameUpdates;

  function addLog(message: string): void {
    connectionLogs = [...connectionLogs, `${new Date().toLocaleTimeString()}: ${message}`];
  }

  // React to game updates
  $: if (latestUpdate) {
    addLog(`Received ${latestUpdate.type}: ${JSON.stringify(latestUpdate.data)}`);
  }

  // React to connection status changes
  $: if (currentState.connectionStatus) {
    addLog(`Connection status: ${currentState.connectionStatus}`);
  }

  async function connectToGame(): Promise<void> {
    try {
      addLog(`Attempting to connect to game: ${testGameId}`);
      await multiplayerActions.connectToGame(testGameId);
      addLog('Connected successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Connection failed: ${errorMessage}`);
    }
  }

  function disconnect(): void {
    addLog('Disconnecting...');
    multiplayerActions.disconnect();
    addLog('Disconnected');
  }

  function sendTestMessage(): void {
    if (!messageToSend.trim()) return;

    const message = {
      type: 'test',
      content: messageToSend,
      timestamp: Date.now()
    };

    addLog(`Sending: ${JSON.stringify(message)}`);
    multiplayerActions.sendMessage(message);

    messageToSend = '';
  }

  async function checkWorkerHealth(): Promise<void> {
    try {
      addLog('Checking WebSocket worker health...');
      const response = await fetch('http://localhost:8787/health');
      const result = await response.text();
      addLog(`Health check result: ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Health check failed: ${errorMessage}`);
    }
  }

  function clearLogs(): void {
    connectionLogs = [];
  }

  onDestroy(() => {
    multiplayerActions.disconnect();
  });
</script>

<div class="min-h-screen bg-gray-900 text-white p-6">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">WebSocket Connection Test</h1>

    <!-- Connection Status -->
    <div class="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Connection Status</h2>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="bg-gray-700 p-3 rounded">
          <div class="text-sm text-gray-400">Status</div>
          <div class="font-semibold" class:text-green-400={currentState.isConnected} class:text-red-400={!currentState.isConnected}>
            {currentState.connectionStatus}
          </div>
        </div>

        <div class="bg-gray-700 p-3 rounded">
          <div class="text-sm text-gray-400">Game ID</div>
          <div class="font-semibold">{currentState.gameId || 'None'}</div>
        </div>

        <div class="bg-gray-700 p-3 rounded">
          <div class="text-sm text-gray-400">Players Online</div>
          <div class="font-semibold">{currentState.playersOnline}</div>
        </div>

        <div class="bg-gray-700 p-3 rounded">
          <div class="text-sm text-gray-400">Last Error</div>
          <div class="font-semibold text-red-400">{currentState.lastError || 'None'}</div>
        </div>
      </div>
    </div>

    <!-- Connection Controls -->
    <div class="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Connection Controls</h2>

      <div class="flex flex-wrap gap-4 mb-4">
        <button
          on:click={checkWorkerHealth}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Check Worker Health
        </button>

        <button
          on:click={connectToGame}
          disabled={currentState.isConnected}
          class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          Connect to Game
        </button>

        <button
          on:click={disconnect}
          disabled={!currentState.isConnected}
          class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div class="flex gap-2">
        <input
          bind:value={testGameId}
          placeholder="Game ID"
          class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        />
      </div>
    </div>

    <!-- Message Testing -->
    <div class="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">Send Test Message</h2>

      <div class="flex gap-2">
        <input
          bind:value={messageToSend}
          on:keydown={(e) => e.key === 'Enter' && sendTestMessage()}
          placeholder="Type a test message..."
          disabled={!currentState.isConnected}
          class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:bg-gray-800 disabled:cursor-not-allowed"
        />
        <button
          on:click={sendTestMessage}
          disabled={!currentState.isConnected || !messageToSend.trim()}
          class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
        >
          Send
        </button>
      </div>
    </div>

    <!-- Connection Logs -->
    <div class="bg-gray-800 rounded-lg p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Connection Logs</h2>
        <button
          on:click={clearLogs}
          class="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
        >
          Clear Logs
        </button>
      </div>

      <div class="bg-gray-900 rounded p-4 h-64 overflow-y-auto font-mono text-sm">
        {#each connectionLogs as log}
          <div class="mb-1 text-gray-300">{log}</div>
        {/each}
        {#if connectionLogs.length === 0}
          <div class="text-gray-500">No logs yet...</div>
        {/if}
      </div>
    </div>

    <!-- Instructions -->
    <div class="mt-6 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
      <h3 class="font-semibold mb-2">🧪 Testing Instructions:</h3>
      <ol class="list-decimal list-inside space-y-1 text-sm text-gray-300">
        <li>First, click "Check Worker Health" to verify the WebSocket worker is running</li>
        <li>Click "Connect to Game" to establish WebSocket connection</li>
        <li>Open this page in another browser tab to test multiplayer</li>
        <li>Send test messages to see real-time communication</li>
        <li>Check the connection logs for detailed information</li>
      </ol>
    </div>
  </div>
</div>
