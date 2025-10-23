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

    console.log(`WebSocket connection established for session ${sessionId}`);

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
      this.sessionManager.removeSession(sessionId);
    });

    server.addEventListener('error', (event) => {
      console.error(`WebSocket error for session ${sessionId}:`, event);
      this.sessionManager.removeSession(sessionId);
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
        messageType: message.type,
        totalSessions: allSessions,
        gameSessionsCount: gameSessions.length,
        gameSessions: gameSessions
      });
      
      const sentCount = this.sessionManager.broadcastToGame(gameId, message);

      if (sentCount === 0) {
        console.warn(`⚠️ [DO] No sessions received notification for game ${gameId}. Sessions found: ${gameSessions.length}`);
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
    console.log(`📨 Processing message from ${sessionId}: ${message.type}`);

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(sessionId, message.gameId);
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

  handleSubscribe(sessionId: string, gameId: string): void {
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
      totalSessionsBefore: allSessions,
      existingGameSessions: existingGameSessions.length
    });

    try {
      this.sessionManager.subscribeToGame(sessionId, gameId);
      const updatedGameSessions = this.sessionManager.getGameSessions(gameId);
      
      console.log(`✅ [DO] Session ${sessionId} successfully subscribed to game ${gameId}:`, {
        totalSessions: allSessions,
        gameSessionsNow: updatedGameSessions.length,
        allGameSessions: updatedGameSessions
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
}

