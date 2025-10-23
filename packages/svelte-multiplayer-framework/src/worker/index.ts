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
  try {
    const gameId = await getGameIdFromRequest(request);
    
    console.log('[Worker] Routing request to Durable Object:', {
      pathname: new URL(request.url).pathname,
      method: request.method,
      gameId
    });

    const id = env.WEBSOCKET_SERVER.idFromName(gameId);
    const durableObject = env.WEBSOCKET_SERVER.get(id);

    return durableObject.fetch(request);
  } catch (error) {
    console.error('[Worker] Error routing to Durable Object:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to route request to Durable Object',
        details: (error as Error).message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      }
    );
  }
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
      // Clone the request to read the body without consuming the original
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      gameId = (body as any).gameId;
      console.log('[Worker] Extracted gameId from POST body:', gameId);
    } catch (error) {
      console.error('[Worker] Error reading gameId from notification body:', error);
      // Don't throw - just use default
    }
  }

  if (!gameId) {
    console.warn('[Worker] No gameId found, using default');
    gameId = 'default';
  }
  
  return gameId;
}

// Export the WebSocketServer class for Durable Objects
export { WebSocketServer } from './WebSocketServer';

