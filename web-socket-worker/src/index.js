/**
 * WebSocket Worker for World Conflict
 * Handles real-time multiplayer communication using Cloudflare Durable Objects
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response('WebSocket service is running', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // Route WebSocket and notification requests to Durable Object
        if (url.pathname === '/websocket' || url.pathname === '/notify') {
            return handleDurableObjectRequest(request, env);
        }

        return new Response('Not found', { status: 404 });
    }
};

/**
 * Routes requests to the appropriate Durable Object instance
 */
async function handleDurableObjectRequest(request, env) {
    const url = new URL(request.url);

    // Extract gameId from query parameters or request body
    let gameId = url.searchParams.get('gameId');

    if (!gameId && request.method === 'POST') {
        try {
            const body = await request.json();
            gameId = body.gameId;
        } catch {
            // If we can't parse the body, use a default room
            gameId = 'default';
        }
    }

    if (!gameId) {
        gameId = 'default';
    }

    // Create Durable Object ID from gameId
    const id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName(gameId);
    const durableObject = env.WEBSOCKET_HIBERNATION_SERVER.get(id);

    // Forward the request to the Durable Object
    return durableObject.fetch(request);
}

/**
 * WebSocket Hibernation Server Durable Object
 * Manages WebSocket connections and game state for a specific game
 */
export class WebSocketHibernationServer {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // sessionId -> WebSocket
        this.gameSubscriptions = new Map(); // sessionId -> gameId
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/websocket') {
            return this.handleWebSocketUpgrade(request);
        }

        if (url.pathname === '/notify' && request.method === 'POST') {
            return this.handleNotification(request);
        }

        return new Response('Not found', { status: 404 });
    }

    /**
     * Handle WebSocket upgrade requests
     */
    handleWebSocketUpgrade(request) {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected websocket', { status: 400 });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        const sessionId = this.generateSessionId();

        // Store the WebSocket connection
        this.sessions.set(sessionId, server);

        server.accept();

        // Handle incoming messages
        server.addEventListener('message', event => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(sessionId, message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                this.sendToSession(sessionId, {
                    type: 'error',
                    data: { error: 'Invalid message format' },
                    timestamp: Date.now()
                });
            }
        });

        // Handle connection close
        server.addEventListener('close', () => {
            this.handleDisconnect(sessionId);
        });

        return new Response(null, {
            status: 101,
            webSocket: client
        });
    }

    /**
     * Handle HTTP notification requests (from the main app)
     */
    async handleNotification(request) {
        try {
            const body = await request.json();
            const { gameId, message } = body;

            console.log(`📢 Broadcasting to game ${gameId}:`, message.type);

            // Broadcast to all sessions subscribed to this game
            await this.broadcastToGame(gameId, message);

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('WebSocket notification error:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(sessionId, message) {
        console.log(`📨 Received message from ${sessionId}:`, message.type);

        switch (message.type) {
            case 'subscribe':
                this.handleSubscribe(sessionId, message.gameId);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(sessionId);
                break;
            case 'ping':
                this.sendToSession(sessionId, { type: 'pong', timestamp: Date.now() });
                break;
            default:
                console.warn(`Unknown message type: ${message.type}`);
        }
    }

    /**
     * Subscribe a session to a game
     */
    handleSubscribe(sessionId, gameId) {
        if (!gameId) {
            this.sendToSession(sessionId, {
                type: 'error',
                data: { error: 'gameId is required for subscription' },
                timestamp: Date.now()
            });
            return;
        }

        this.gameSubscriptions.set(sessionId, gameId);
        console.log(`✅ Session ${sessionId} subscribed to game ${gameId}`);

        this.sendToSession(sessionId, {
            type: 'subscribed',
            gameId: gameId,
            timestamp: Date.now()
        });
    }

    /**
     * Unsubscribe a session from its current game
     */
    handleUnsubscribe(sessionId) {
        const gameId = this.gameSubscriptions.get(sessionId);
        if (gameId) {
            this.gameSubscriptions.delete(sessionId);
            console.log(`❌ Session ${sessionId} unsubscribed from game ${gameId}`);
        }
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(sessionId) {
        console.log(`🔌 Session ${sessionId} disconnected`);
        this.sessions.delete(sessionId);
        this.gameSubscriptions.delete(sessionId);
    }

    /**
     * Send message to a specific session
     */
    sendToSession(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (session && session.readyState === WebSocket.READY_STATE_OPEN) {
            try {
                session.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Failed to send message to session ${sessionId}:`, error);
                this.handleDisconnect(sessionId);
            }
        }
    }

    /**
     * Broadcast message to all sessions subscribed to a game
     */
    async broadcastToGame(gameId, message) {
        let sentCount = 0;

        for (const [sessionId, subscribedGameId] of this.gameSubscriptions.entries()) {
            if (subscribedGameId === gameId) {
                this.sendToSession(sessionId, message);
                sentCount++;
            }
        }

        console.log(`📤 Broadcast to ${sentCount} sessions for game ${gameId}`);
        return sentCount;
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
