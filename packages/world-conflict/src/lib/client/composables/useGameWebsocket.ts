import { GameWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';
import { writable, type Writable } from 'svelte/store';

/**
 * Composable for managing WebSocket connection to a game
 * Handles connection lifecycle, error handling, and message routing
 */
export function useGameWebSocket(
  gameId: string,
  onGameUpdate: (gameData: any) => void
) {
  let wsClient: GameWebSocketClient | null = null;
  const connected: Writable<boolean> = writable(false);

  /**
   * Initialize and connect to the WebSocket server
   */
  async function initialize(): Promise<void> {
    console.log('[WS INIT] Starting WebSocket initialization');
    console.log('[WS INIT] gameId:', gameId, 'type:', typeof gameId);

    // Validate gameId
    if (!gameId || gameId === 'null' || gameId === 'undefined' || gameId === '') {
      const error = `Invalid gameId: "${gameId}"`;
      console.error('[WS INIT]', error);
      throw new Error(error);
    }

    console.log('[WS INIT] gameId is valid');

    // Create WebSocket client
    wsClient = new GameWebSocketClient();
    console.log('[WS INIT] GameWebSocketClient created');

    // Sync the client's connected store with our local store
    wsClient.connected.subscribe((isConnected) => {
      connected.set(isConnected);
    });

    // Register callbacks BEFORE connecting
    wsClient.onError((error) => {
      console.error('[WS ERROR]', error);
    });

    wsClient.onGameUpdate((gameData) => {
      console.log('📨 [WS UPDATE] Received game update', {
        currentPlayerSlot: gameData?.currentPlayerSlot,
        turnNumber: gameData?.turnNumber,
        hasPlayers: !!gameData?.players
      });
      onGameUpdate(gameData);
    });

    wsClient.onConnected(() => {
      console.log('[WS CONNECTED] Successfully connected to game WebSocket');
    });

    wsClient.onDisconnected(() => {
      console.warn('[WS DISCONNECTED] Disconnected from game WebSocket');
    });

    console.log('[WS INIT] Callbacks registered, attempting connection...');

    try {
      // Connect to the WebSocket
      await wsClient.connect(gameId);
      console.log('[WS INIT] Connection established successfully');
    } catch (error) {
      console.error('[WS INIT] Failed to initialize WebSocket:', error);
      console.error('[WS INIT] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        gameId: gameId
      });

      // FAIL FAST - throw error instead of silently continuing
      throw new Error(
        `WebSocket connection required but failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Clean up WebSocket connection
   */
  function cleanup(): void {
    if (wsClient) {
      wsClient.disconnect();
      wsClient = null;
    }
    connected.set(false);
  }

  /**
   * Get the reactive connected store
   */
  function getConnectedStore() {
    return connected;
  }

  /**
   * Check if WebSocket is currently connected (for backwards compatibility)
   */
  function isConnected(): boolean {
    return wsClient?.isConnected() ?? false;
  }

  return {
    initialize,
    cleanup,
    isConnected,
    getConnectedStore
  };
}
