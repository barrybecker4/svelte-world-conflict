import { MessageHandler } from './MessageHandler';
import type { WebSocketConfig } from '../shared';
import { buildWebSocketUrl } from '../shared';
import { writable, type Writable } from 'svelte/store';

/**
 * Generic WebSocket client for multiplayer communication
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;
  private playerId: string | null = null;
  private messageHandler: MessageHandler;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private config: WebSocketConfig;
  public connected: Writable<boolean>;

  constructor(config: WebSocketConfig, playerId?: string) {
    this.config = config;
    this.playerId = playerId || null;
    this.messageHandler = new MessageHandler();
    this.connected = writable(false);
  }

  /**
   * Connect to WebSocket server for a specific game
   */
  async connect(gameId: string): Promise<void> {
    this.gameId = gameId;

    try {
      const wsUrl = buildWebSocketUrl(gameId, this.config);
      console.log('Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      // Set up handlers that persist for the lifetime of the connection
      this.setupOperationalHandlers();

      // Wait for connection to establish (one-time)
      await this.waitForConnection();
    } catch (error) {
      this.clearConnectionTimeout();
      throw error;
    }
  }

  /**
   * Set up message handler that persists after connection
   */
  private setupOperationalHandlers(): void {
    if (!this.ws) return;

    // Handle incoming messages (persists for lifetime of connection)
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', {
          type: message.type,
          gameId: message.gameId,
          hasGameState: !!message.gameState
        });
        this.messageHandler.handleMessage(message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
        this.messageHandler.triggerError('Failed to parse message');
      }
    };

    // Handle disconnection (after successful connection)
    this.ws.onclose = (event) => {
      console.log(
        `🔌 WebSocket closed: code=${event.code}, reason=${event.reason || 'none'}`
      );
      this.connected.set(false);
      this.messageHandler.triggerDisconnected();
    };
  }

  /**
   * Wait for connection to establish, fail, or timeout
   * Uses Promise.race to handle all outcomes
   */
  private waitForConnection(): Promise<void> {
    return Promise.race([
      this.waitForOpen(),
      this.waitForFailure(),
      this.waitForTimeout(10000)
    ]);
  }

  /**
   * Resolves when WebSocket opens successfully
   */
  private waitForOpen(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.clearConnectionTimeout();
        this.connected.set(true);

        // Send subscribe message with optional playerId for disconnect tracking
        const subscribeMessage: any = { type: 'subscribe', gameId: this.gameId! };
        if (this.playerId) {
          subscribeMessage.playerId = this.playerId;
          console.log(`🆔 [WS] Subscribing with playerId: ${this.playerId}`);
        } else {
          console.log(`⚠️ [WS] Subscribing WITHOUT playerId (observer mode)`);
        }
        this.send(subscribeMessage);
        this.messageHandler.triggerConnected();

        resolve();
      };
    });
  }

  /**
   * Rejects when WebSocket fails or closes before connecting
   */
  private waitForFailure(): Promise<void> {
    return new Promise((_, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      // Temporarily override error handler for initial connection
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.clearConnectionTimeout();
        this.messageHandler.triggerError('WebSocket connection failed');
        reject(new Error('WebSocket connection failed'));
      };

      // Temporarily override close handler for initial connection
      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: code=${event.code}`);
        this.clearConnectionTimeout();
        this.connected.set(false);
        this.messageHandler.triggerDisconnected();
        reject(new Error(`WebSocket closed before connection established: ${event.code}`));
      };
    });
  }

  /**
   * Rejects after timeout period
   */
  private waitForTimeout(ms: number): Promise<void> {
    return new Promise((_, reject) => {
      this.connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.error('❌ WebSocket connection timeout');
          this.cleanup();
          reject(new Error('WebSocket connection timeout'));
        }
      }, ms);
    });
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  private cleanup(): void {
    this.clearConnectionTimeout();
    this.stopKeepAlive();
    this.connected.set(false);
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, 'Client cleanup');
      }
      this.ws = null;
    }
  }

  disconnect(): void {
    console.log('Disconnecting WebSocket');
    this.stopKeepAlive();
    this.connected.set(false);
    this.cleanup();
    this.gameId = null;
    this.messageHandler.clearCallbacks();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(message: any): void {
    if (this.isConnected()) {
      try {
        this.ws!.send(JSON.stringify(message));
        console.log('📤 Sent WebSocket message:', message.type);
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
      }
    } else {
      console.warn(
        '⚠️ Cannot send message: WebSocket not connected (state:',
        this.ws?.readyState,
        ')'
      );
    }
  }

  private keepAliveInterval: number | null = null;

  startKeepAlive(intervalMs: number = 30000): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    const keepAlive = () => {
      if (this.isConnected()) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    };

    setTimeout(keepAlive, 1000);
    this.keepAliveInterval = window.setInterval(keepAlive, intervalMs);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // Delegate callback registration to MessageHandler
  onGameUpdate(callback: (data: any) => void): void {
    this.messageHandler.onGameUpdate(callback);
  }

  onGameStarted(callback: (data: any) => void): void {
    this.messageHandler.onGameStarted(callback);
  }

  onPlayerJoined(callback: (data: any) => void): void {
    this.messageHandler.onPlayerJoined(callback);
  }

  onGameEnded(callback: (data: any) => void): void {
    this.messageHandler.onGameEnded(callback);
  }

  onError(callback: (error: string) => void): void {
    this.messageHandler.onError(callback);
  }

  onConnected(callback: () => void): void {
    this.messageHandler.onConnected(callback);
  }

  onDisconnected(callback: () => void): void {
    this.messageHandler.onDisconnected(callback);
  }

  /**
   * Register a custom message type handler
   * Allows extending the client with game-specific message types
   */
  on(messageType: string, callback: (data: any) => void): void {
    this.messageHandler.on(messageType, callback);
  }
}

