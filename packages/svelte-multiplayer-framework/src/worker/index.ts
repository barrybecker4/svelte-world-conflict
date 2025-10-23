import { WebSocketServer } from './WebSocketServer';

/**
 * Common CORS headers for cross-origin requests
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * WebSocket Worker for multiplayer games
 * This is the main entry point for the Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('WebSocket worker is healthy', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...CORS_HEADERS
        }
      });
    }

    // Route WebSocket and notification requests to Durable Object
    if (url.pathname === '/websocket' || url.pathname === '/notify') {
      return handleDurableObjectRequest(request, env);
    }

    return new Response('Not found', {
      status: 404,
      headers: CORS_HEADERS
    });
  }
};

/**
 * Routes requests to the appropriate Durable Object instance
 */
async function handleDurableObjectRequest(request: Request, env: any): Promise<Response> {
  const gameId = await getGameIdFromRequest(request);

  const id = env.WEBSOCKET_SERVER.idFromName(gameId);
  const durableObject = env.WEBSOCKET_SERVER.get(id);

  return durableObject.fetch(request);
}

/**
 * Extract gameId from request (query param or body)
 */
async function getGameIdFromRequest(request: Request): Promise<string> {
  const url = new URL(request.url);
  let gameId = url.searchParams.get('gameId');

  // For POST requests (notifications), get gameId from body
  if (!gameId && request.method === 'POST' && url.pathname === '/notify') {
    try {
      // Clone the request to read the body
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      gameId = (body as any).gameId;
    } catch (error) {
      console.error('Error reading gameId from notification body:', error);
    }
  }

  if (!gameId) {
    gameId = 'default';
  }
  return gameId;
}

export { WebSocketServer };

