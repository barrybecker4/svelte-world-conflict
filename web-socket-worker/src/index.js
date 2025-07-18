/**
 * WebSocket Worker for World Conflict
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
            const { gameId, type, data } = await request.json();

            if (!gameId || !type) {
                return new Response('Missing gameId or type', { status: 400 });
            }

            // Broadcast to all sessions subscribed to this game
            this.broadcastToGame(gameId, {
                type,
                data,
                timestamp: Date.now()
            });

            return new Response('Notification sent', { status: 200 });
        } catch (error) {
            console.error('Error handling notification:', error);
            return new Response('Error processing notification', { status: 500 });
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(sessionId, message) {
        console.log(`Message from ${sessionId}:`, message.type);

        switch (message.type) {
            case 'subscribe':
                this.handleSubscribe(sessionId, message.gameId);
                break;

            case 'unsubscribe':
                this.handleUnsubscribe(sessionId);
                break;

            case 'ping':
                this.sendToSession(sessionId, {
                    type: 'pong',
                    timestamp: Date.now()
                });
                break;

            default:
                console.warn(`Unknown message type: ${message.type}`);
                this.sendToSession(sessionId, {
                    type: 'error',
                    data: { error: `Unknown message type: ${message.type}` },
                    timestamp: Date.now()
                });
        }
    }

    /**
     * Handle game subscription
     */
    handleSubscribe(sessionId, gameId) {
        if (!gameId) {
            this.sendToSession(sessionId, {
                type: 'error',
                data: { error: 'Missing gameId' },
                timestamp: Date.now()
            });
            return;
        }

        // Store subscription
        this.gameSubscriptions.set(sessionId, gameId);

        // Send confirmation
        this.sendToSession(sessionId, {
            type: 'subscribed',
            gameId,
            timestamp: Date.now()
        });

        console.log(`Session ${sessionId} subscribed to game ${gameId}`);
    }

    /**
     * Handle game unsubscription
     */
    handleUnsubscribe(sessionId) {
        const gameId = this.gameSubscriptions.get(sessionId);
        if (gameId) {
            this.gameSubscriptions.delete(sessionId);
            console.log(`Session ${sessionId} unsubscribed from game ${gameId}`);
        }
    }

    /**
     * Handle session disconnect
     */
    handleDisconnect(sessionId) {
        console.log(`Session ${sessionId} disconnected`);

        // Clean up
        this.sessions.delete(sessionId);
        this.gameSubscriptions.delete(sessionId);
    }

    /**
     * Send message to a specific session
     */
    sendToSession(sessionId, message) {
        const ws = this.sessions.get(sessionId);
        if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error(`Error sending to session ${sessionId}:`, error);
                this.handleDisconnect(sessionId);
            }
        }
    }

    /**
     * Broadcast message to all sessions subscribed to a game
     */
    broadcastToGame(gameId, message) {
        let sentCount = 0;

        for (const [sessionId, subscribedGameId] of this.gameSubscriptions.entries()) {
            if (subscribedGameId === gameId) {
                this.sendToSession(sessionId, message);
                sentCount++;
            }
        }

        console.log(`Broadcast to ${sentCount} sessions for game ${gameId}`);
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
}
