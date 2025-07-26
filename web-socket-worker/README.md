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

## Setup Instructions

### Deploy WebSocket Worker (One-time setup)

The WebSocket worker handles real-time game coordination using Cloudflare Durable Objects:

```bash
# Navigate to websocket worker directory
cd websocket-worker

# Install dependencies
npm install

# Deploy the WebSocket worker to Cloudflare
npm run deploy

# Return to main directory
cd ..
```

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# View logs
npm run tail
```

## Local Development

For local development, use the simple setup:

```bash
cd websocket-worker
npx wrangler dev --local --port 8787
```
Then in project root, run `npm run dev`

This will connect to the local webSocket worker. It does not use Cloudflare, and it's very fast. 

When running locally on port 8787:
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
