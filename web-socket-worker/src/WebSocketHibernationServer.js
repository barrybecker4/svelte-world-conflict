import { SessionManager } from './SessionManager.js';

/**
 * WebSocket Hibernation Server Durable Object
 * Manages WebSocket connections and game state for a specific game
 */
export class WebSocketHibernationServer {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessionManager = new SessionManager();
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

    handleWebSocketUpgrade(request) {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected websocket', { status: 400 });
        }

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        const sessionId = this.sessionManager.generateSessionId();
        this.sessionManager.addSession(sessionId, server);

        server.accept();

        // Handle incoming messages
        server.addEventListener('message', event => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(sessionId, message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                this.sessionManager.sendToSession(sessionId, {
                    type: 'error',
                    data: { error: 'Invalid message format' },
                    timestamp: Date.now()
                });
            }
        });

        server.addEventListener('close', () => {
            this.sessionManager.removeSession(sessionId);
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

            if (!gameId || !message) {
                return new Response(JSON.stringify({
                    error: 'Missing gameId or message'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Use SessionManager to broadcast
            console.log('handleNotification received:', message);
            const sentCount = this.sessionManager.broadcastToGame(gameId, {
                type: message.type,
                data: message.gameState,
                timestamp: Date.now()
            });

            return new Response(JSON.stringify({
                success: true,
                sentCount
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Error handling notification:', error);
            return new Response(JSON.stringify({
                error: 'Error processing notification',
                details: error.message
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    handleMessage(sessionId, message) {
        console.log(`Message from ${sessionId}:`, JSON.stringify(message));

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
                console.warn(`Unknown message type: ${message.type}`);
                this.sessionManager.sendToSession(sessionId, {
                    type: 'error',
                    data: { error: `Unknown message type: ${message.type}` },
                    timestamp: Date.now()
                });
        }
    }

    handleSubscribe(sessionId, gameId) {
        if (!gameId) {
            this.sessionManager.sendToSession(sessionId, {
                type: 'error',
                data: { error: 'Missing gameId' },
                timestamp: Date.now()
            });
            return;
        }

        try {
            this.sessionManager.subscribeToGame(sessionId, gameId);
            this.sessionManager.sendToSession(sessionId, {
                type: 'subscribed',
                gameId,
                timestamp: Date.now()
            });
        } catch (error) {
            this.sessionManager.sendToSession(sessionId, {
                type: 'error',
                data: { error: error.message },
                timestamp: Date.now()
            });
        }
    }

    handleUnsubscribe(sessionId) {
        const gameId = this.sessionManager.unsubscribeFromGame(sessionId);
        if (gameId) {
            this.sessionManager.sendToSession(sessionId, {
                type: 'unsubscribed',
                gameId,
                timestamp: Date.now()
            });
        }
    }
}
