import { SessionManager } from './SessionManager';

/**
 * WebSocket Server Durable Object
 * Manages WebSocket connections and game state for a specific game
 */
export class WebSocketServer {
  private state: DurableObjectState;
  private env: any;
  private sessionManager: SessionManager;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.sessionManager = new SessionManager();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    if (url.pathname === '/notify' && request.method === 'POST') {
      return this.handleNotification(request);
    }

    return new Response('Not found', { status: 404 });
  }

  handleWebSocketUpgrade(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    const sessionId = this.sessionManager.generateSessionId();
    server.accept();
    this.sessionManager.addSession(sessionId, server);

    // Extract request metadata for debugging cross-region issues
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId') || 'unknown';
    const cfInfo = (request as any).cf || {};
    
    console.log(`🔌 [DO] WebSocket connection established:`, {
      sessionId,
      gameId,
      durableObjectId: this.state.id.toString(),
      clientDatacenter: cfInfo.colo || 'unknown',
      clientCountry: cfInfo.country || 'unknown',
      clientCity: cfInfo.city || 'unknown',
      clientTimezone: cfInfo.timezone || 'unknown',
      timestamp: Date.now()
    });

    // Handle incoming messages
    server.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string);
        console.log(`Received message from ${sessionId}:`, message.type);
        this.handleMessage(sessionId, message);
      } catch (error) {
        console.error(`Error parsing message from ${sessionId}:`, error);
        this.sessionManager.sendToSession(sessionId, {
          type: 'error',
          gameState: { error: 'Invalid message format' },
          timestamp: Date.now()
        });
      }
    });

    server.addEventListener('close', (event) => {
      console.log(
        `WebSocket closed for session ${sessionId}: code=${event.code}, reason=${event.reason}`
      );
      const { gameId, playerId } = this.sessionManager.removeSession(sessionId);
      
      console.log(`🔍 [DO] Disconnect detected - gameId: ${gameId}, playerId: ${playerId || 'NONE'}`);
      
      // If player was identified, notify the game application about the disconnect
      if (gameId && playerId) {
        console.log(`📞 [DO] Calling notifyPlayerDisconnect for player ${playerId} in game ${gameId}`);
        this.notifyPlayerDisconnect(gameId, playerId);
      } else {
        console.log(`⚠️ [DO] Skipping disconnect notification - missing ${!gameId ? 'gameId' : 'playerId'}`);
      }
    });

    server.addEventListener('error', (event) => {
      console.error(`WebSocket error for session ${sessionId}:`, event);
      const { gameId, playerId } = this.sessionManager.removeSession(sessionId);
      
      // If player was identified, notify the game application about the disconnect
      if (gameId && playerId) {
        this.notifyPlayerDisconnect(gameId, playerId);
      }
    });

    // Return the client side of the WebSocket pair
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle HTTP notification requests (from the main app)
   */
  async handleNotification(request: Request): Promise<Response> {
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    try {
      const body = await request.json();
      const { gameId, message } = body as { gameId: string; message: any };

      if (!gameId || !message) {
        console.error('❌ [DO] Invalid notification request:', { 
          hasGameId: !!gameId, 
          hasMessage: !!message,
          body 
        });
        return new Response(
          JSON.stringify({
            error: 'Missing gameId or message'
          }),
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const allSessions = this.sessionManager.getAllSessionCount();
      const gameSessions = this.sessionManager.getGameSessions(gameId);
      
      console.log(`📬 [DO] Notification received for game ${gameId}:`, {
        durableObjectId: this.state.id.toString(),
        messageType: message.type,
        totalSessions: allSessions,
        gameSessionsCount: gameSessions.length,
        gameSessions: gameSessions,
        timestamp: Date.now()
      });
      
      const sentCount = this.sessionManager.broadcastToGame(gameId, message);

      if (sentCount === 0) {
        console.warn(`⚠️ [DO] No sessions received notification for game ${gameId}:`, {
          durableObjectId: this.state.id.toString(),
          sessionsFound: gameSessions.length,
          allSessions: allSessions,
          messageType: message.type
        });
      } else {
        console.log(`✅ [DO] Notification broadcast successful:`, {
          durableObjectId: this.state.id.toString(),
          gameId,
          sentCount,
          totalGameSessions: gameSessions.length,
          messageType: message.type
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          sentCount,
          gameId,
          totalSessions: allSessions,
          gameSessions: gameSessions.length
        }),
        {
          status: 200,
          headers: corsHeaders
        }
      );
    } catch (error) {
      console.error('❌ [DO] Error handling notification:', error);
      return new Response(
        JSON.stringify({
          error: 'Error processing notification',
          details: (error as Error).message
        }),
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }
  }

  handleMessage(sessionId: string, message: any): void {
    console.log(`📨 Processing message from ${sessionId}: ${message.type}`, {
      gameId: message.gameId,
      playerId: message.playerId || 'NONE'
    });

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(sessionId, message.gameId, message.playerId);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(sessionId);
        break;

      case 'ping':
        this.sessionManager.sendToSession(sessionId, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;

      default:
        console.warn(`Unknown message type from ${sessionId}: ${message.type}`);
        this.sessionManager.sendToSession(sessionId, {
          type: 'error',
          gameState: { error: `Unknown message type: ${message.type}` },
          timestamp: Date.now()
        });
    }
  }

  handleSubscribe(sessionId: string, gameId: string, playerId?: string): void {
    if (!gameId) {
      console.error(`❌ [DO] Session ${sessionId} tried to subscribe without gameId`);
      this.sessionManager.sendToSession(sessionId, {
        type: 'error',
        gameState: { error: 'Missing gameId' },
        timestamp: Date.now()
      });
      return;
    }

    const allSessions = this.sessionManager.getAllSessionCount();
    const existingGameSessions = this.sessionManager.getGameSessions(gameId);
    
    console.log(`📝 [DO] Session ${sessionId} subscribing to game ${gameId}:`, {
      durableObjectId: this.state.id.toString(),
      totalSessionsBefore: allSessions,
      existingGameSessions: existingGameSessions.length,
      existingSessionIds: existingGameSessions,
      playerId: playerId || 'none (observer)'
    });

    try {
      this.sessionManager.subscribeToGame(sessionId, gameId, playerId);
      const updatedGameSessions = this.sessionManager.getGameSessions(gameId);
      
      console.log(`✅ [DO] Session ${sessionId} successfully subscribed to game ${gameId}:`, {
        durableObjectId: this.state.id.toString(),
        totalSessions: allSessions,
        gameSessionsNow: updatedGameSessions.length,
        allGameSessions: updatedGameSessions,
        playerId: playerId || 'none',
        timestamp: Date.now()
      });
      
      this.sessionManager.sendToSession(sessionId, {
        type: 'subscribed',
        gameId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ [DO] Error subscribing session ${sessionId} to game ${gameId}:`, error);
      this.sessionManager.sendToSession(sessionId, {
        type: 'error',
        gameState: { error: (error as Error).message },
        timestamp: Date.now()
      });
    }
  }

  handleUnsubscribe(sessionId: string): void {
    const gameId = this.sessionManager.unsubscribeFromGame(sessionId);
    if (gameId) {
      console.log(`Session ${sessionId} unsubscribed from game ${gameId}`);
      this.sessionManager.sendToSession(sessionId, {
        type: 'unsubscribed',
        gameId,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Notify the game application that a player has disconnected
   * Uses convention-based endpoint: POST /api/game/{gameId}/player-event
   * This allows game-specific handling of disconnects (elimination, grace period, etc.)
   */
  async notifyPlayerDisconnect(gameId: string, playerId: string): Promise<void> {
    try {
      console.log(`🔌 [DO] Player ${playerId} disconnected from game ${gameId}, notifying application...`);
      
      // Build the notification URL
      // In production, this should point to the application's API
      // The env.WORKER_URL should be set to the application's base URL
      const baseUrl = this.env.WORKER_URL || 'http://localhost:5173';
      const url = `${baseUrl}/api/game/${gameId}/player-event`;
      
      const payload = {
        type: 'disconnect',
        playerId,
        timestamp: Date.now()
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log(`✅ [DO] Successfully notified application of player ${playerId} disconnect`);
      } else if (response.status === 404) {
        console.log(`ℹ️ [DO] Player-event endpoint not found (404) - game doesn't implement disconnect handling`);
      } else {
        console.warn(`⚠️ [DO] Failed to notify disconnect: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Log but don't throw - disconnect notifications are best-effort
      console.error(`❌ [DO] Error notifying player disconnect:`, error);
    }
  }
}

