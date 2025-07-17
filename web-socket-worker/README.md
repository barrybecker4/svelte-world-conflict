# World Conflict WebSocket Worker

This Cloudflare Worker handles real-time multiplayer communication for World Conflict using Durable Objects.

## Features

- **WebSocket connections** for real-time game updates
- **Durable Objects** for persistent connection state
- **Game-based routing** - each game gets its own Durable Object instance
- **Health monitoring** endpoint
- **Automatic reconnection** handling

## Architecture

```
Game Client ←→ WebSocket Worker (Durable Object) ←→ Main App (SvelteKit)
                      ↕
                 Cloudflare KV
```

## Endpoints

- `GET /health` - Health check
- `GET /websocket?gameId=<id>` - WebSocket upgrade
- `POST /notify` - Send notifications to game sessions

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Deploy to Cloudflare
npm run deploy

# View logs
npm run tail
```

## Local Development

When running locally on port 8787:
- WebSocket URL: `ws://localhost:8787/websocket?gameId=<gameId>`
- Health check: `http://localhost:8787/health`

## Message Types

### Client → Server
- `subscribe` - Subscribe to game updates
- `unsubscribe` - Unsubscribe from current game
- `ping` - Keep-alive ping

### Server → Client
- `subscribed` - Confirmation of subscription
- `gameUpdate` - Game state changed
- `playerJoined` - New player joined
- `pong` - Response to ping
- `error` - Error message

## Example Usage

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8787/websocket?gameId=game123');

// Subscribe to game updates
ws.send(JSON.stringify({
  type: 'subscribe',
  gameId: 'game123'
}));

// Listen for updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Deployment

The worker is automatically referenced in the main app's `wrangler.toml`:

```toml
[env.production.durable_objects]
bindings = [
    { name = "WEBSOCKET_HIBERNATION_SERVER", class_name = "WebSocketHibernationServer", script_name = "svelte-world-conflict-websocket" }
]
```
