import { GameWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';
import { writable, type Writable } from 'svelte/store';

/**
 * Composable for managing WebSocket connection to a game
 * Handles connection lifecycle, error handling, and message routing
 */
export function useGameWebSocket(
  gameId: string,
  onGameUpdate: (gameData: any) => void,
  playerId?: string
) {
  let wsClient: GameWebSocketClient | null = null;
  const connected: Writable<boolean> = writable(false);

  /**
   * Initialize and connect to the WebSocket server
   */
  async function initialize(): Promise<void> {
    if (!gameId || gameId === 'null' || gameId === 'undefined' || gameId === '') {
      throw new Error(`Invalid gameId: "${gameId}"`);
    }

    wsClient = new GameWebSocketClient(playerId);
    wsClient.connected.subscribe((isConnected) => connected.set(isConnected));
    wsClient.onError((error) => console.error('[WS] Error:', error));
    wsClient.onGameUpdate(onGameUpdate);

    try {
      await wsClient.connect(gameId);
    } catch (error) {
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
    wsClient?.disconnect();
    wsClient = null;
    connected.set(false);
  }

  /**
   * Get the reactive connected store
   */
  function getConnectedStore(): Writable<boolean> {
    return connected;
  }

  /**
   * Check if WebSocket is currently connected
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
