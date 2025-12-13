import { WebSocketServer, type WebSocketServerEnv } from './WebSocketServer';
import { isLocalDevelopment } from '../shared';

/**
 * Worker environment with Durable Object bindings
 */
export interface WorkerEnv extends WebSocketServerEnv {
  WEBSOCKET_SERVER: DurableObjectNamespace;
}

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
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
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
async function handleDurableObjectRequest(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const gameId = await getGameIdFromRequest(request);
    const url = new URL(request.url);

    // Use location hint to ensure consistent global routing
    // All game instances route to Western North America for accessibility from any region
    // NOTE: Location hint is disabled in local dev (localhost) to avoid routing issues with wrangler dev
    const locationHint = 'wnam'; // Western North America (California, Oregon)

    // Detect local dev using shared utility function
    // This is more reliable than env variables which may not be set correctly
    const isLocalDev = isLocalDevelopment(url);

    // Get Cloudflare datacenter information if available (only in production)
    const cfInfo = (request as Request & { cf?: Record<string, unknown> }).cf || {};
    const cfDatacenter = cfInfo.colo || 'unknown';
    const cfCountry = cfInfo.country || 'unknown';

    console.log('[Worker] Routing request to Durable Object:', {
      pathname: url.pathname,
      method: request.method,
      gameId,
      locationHint: isLocalDev ? 'disabled (local dev)' : locationHint,
      isLocalDev,
      hostname: url.hostname,
      port: url.port,
      cfDatacenter,
      cfCountry,
      requestId: crypto.randomUUID()
    });

    const id = env.WEBSOCKET_SERVER.idFromName(gameId);

    // Only use locationHint in production to ensure cross-region routing
    // In local dev, skip locationHint as wrangler dev doesn't support it properly
    const durableObject = isLocalDev
      ? env.WEBSOCKET_SERVER.get(id)
      : env.WEBSOCKET_SERVER.get(id, { locationHint });

    console.log('[Worker] Durable Object requested:', {
      gameId,
      durableObjectId: id.toString(),
      usedLocationHint: !isLocalDev,
      locationHint: isLocalDev ? 'none' : locationHint
    });

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
 * Body shape for notification requests
 */
interface NotificationBody {
  gameId?: string;
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
      const body = await clonedRequest.json() as NotificationBody;
      gameId = body.gameId ?? null;
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
export { WebSocketServer, type WebSocketServerEnv } from './WebSocketServer';
export { SessionManager, type SessionInfo, type SessionRemovalResult } from './SessionManager';

