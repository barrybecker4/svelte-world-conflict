# Svelte Multiplayer Framework

A minimal WebSocket framework for building real-time multiplayer Svelte games with Cloudflare infrastructure.

## Features

- **Client WebSocket Management** - Robust connection handling with automatic reconnection
- **Server Storage Abstraction** - Pluggable storage adapters (Cloudflare KV included)
- **Cloudflare Durable Objects Worker** - Scalable WebSocket server with session management
- **Type-Safe** - Full TypeScript support with extensible message types
- **Minimal & Generic** - No game-specific logic, works with any turn-based or real-time game

## Installation

This package is part of a monorepo. Install dependencies from the root:

```bash
npm install
```

## Quick Start

### 1. Deploy the WebSocket Worker

```bash
cd packages/svelte-multiplayer-framework/src/worker
npx wrangler deploy
```

Note the deployed worker URL (e.g., `your-worker.workers.dev`)

### 2. Client Setup

```typescript
import { WebSocketClient } from '@svelte-mp/framework/client';
import type { WebSocketConfig } from '@svelte-mp/framework/shared';

// Configure your worker URL
const config: WebSocketConfig = {
  workerUrl: 'your-worker.workers.dev',
  localHost: 'localhost:8787' // for local development
};

// Create client
const client = new WebSocketClient(config);

// Connect to a game
await client.connect('game-123');

// Listen for game updates
client.onGameUpdate((gameState) => {
  console.log('Game updated:', gameState);
});

// Send custom messages
client.send({
  type: 'playerMove',
  move: { /* your move data */ }
});

// Disconnect when done
client.disconnect();
```

### 3. Server Setup (SvelteKit)

```typescript
// src/routes/api/game/[gameId]/move/+server.ts
import { KVStorageAdapter } from '@svelte-mp/framework/server';
import { json } from '@sveltejs/kit';

export async function POST({ request, platform, params }) {
  // Initialize storage
  const storage = new KVStorageAdapter(platform, {
    kvBindingName: 'YOUR_KV_NAMESPACE'
  });

  // Load game state
  const gameId = params.gameId;
  const game = await storage.get(`game:${gameId}`);

  // Process move and update state
  // ... your game logic ...

  // Save updated state
  await storage.put(`game:${gameId}`, updatedGame);

  // Notify all connected clients via WebSocket worker
  await notifyClients(gameId, {
    type: 'gameUpdate',
    gameId,
    gameState: updatedGame
  });

  return json({ success: true });
}

async function notifyClients(gameId: string, message: any) {
  const workerUrl = 'https://your-worker.workers.dev/notify';
  await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, message })
  });
}
```

## Architecture

```
┌─────────────────┐     WebSocket     ┌──────────────────┐     HTTP      ┌─────────────┐
│  Svelte Client  │◄─────────────────▶│  Durable Object  │◄─────────────▶│  SvelteKit  │
│                 │    real-time      │  (per game)      │  notifications│  API Routes │
│ • Game UI       │                   │                  │               │             │
│ • WebSocket     │                   │ • Session mgmt   │               │ • Game      │
│   Client        │                   │ • Broadcasting   │               │   Logic     │
└─────────────────┘                   └──────────────────┘               │ • Storage   │
                                                                         └─────────────┘
```

## API Reference

### Client

#### `WebSocketClient`

```typescript
class WebSocketClient {
  constructor(config: WebSocketConfig);
  
  // Connection management
  connect(gameId: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  startKeepAlive(intervalMs?: number): void;
  
  // Send messages
  send(message: any): void;
  
  // Standard event handlers
  onGameUpdate(callback: (data: any) => void): void;
  onGameStarted(callback: (data: any) => void): void;
  onPlayerJoined(callback: (data: any) => void): void;
  onGameEnded(callback: (data: any) => void): void;
  onError(callback: (error: string) => void): void;
  onConnected(callback: () => void): void;
  onDisconnected(callback: () => void): void;
  
  // Custom message types
  on(messageType: string, callback: (data: any) => void): void;
}
```

### Server

#### `StorageAdapter` Interface

```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<{ keys: Array<{ name: string }> }>;
  getStorageInfo(): { type: string; [key: string]: any };
}
```

#### `KVStorageAdapter`

```typescript
class KVStorageAdapter implements StorageAdapter {
  constructor(platform: KVPlatform, config: KVStorageConfig);
  // Implements all StorageAdapter methods
}
```

### Message Types

The framework defines standard message types that you can extend:

```typescript
// Standard messages
type StandardMessage =
  | { type: 'gameUpdate'; gameId: string; gameState: any }
  | { type: 'gameStarted'; gameId: string; gameState: any }
  | { type: 'playerJoined'; gameId: string; gameState: any }
  | { type: 'gameEnded'; gameId: string; gameState: any }
  | { type: 'error'; gameState: { error: string } }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number };

// Add custom messages in your game
client.on('customEvent', (data) => {
  // Handle your custom message type
});
```

## Example: Simple Tic-Tac-Toe

Here's a minimal example of using the framework for tic-tac-toe:

```typescript
// client.ts
import { WebSocketClient } from '@svelte-mp/framework/client';

const client = new WebSocketClient({
  workerUrl: 'tic-tac-toe-ws.workers.dev'
});

await client.connect('game-123');

client.onGameUpdate((board) => {
  renderBoard(board);
});

// Make a move
function makeMove(x: number, y: number) {
  client.send({
    type: 'move',
    position: { x, y }
  });
}

// server API route
export async function POST({ request, platform }) {
  const storage = new KVStorageAdapter(platform, { kvBindingName: 'TTT_KV' });
  const { gameId, position } = await request.json();
  
  const game = await storage.get(`game:${gameId}`);
  game.board[position.x][position.y] = game.currentPlayer;
  
  await storage.put(`game:${gameId}`, game);
  
  // Notify all players
  await fetch('https://tic-tac-toe-ws.workers.dev/notify', {
    method: 'POST',
    body: JSON.stringify({
      gameId,
      message: { type: 'gameUpdate', gameId, gameState: game }
    })
  });
  
  return json({ success: true });
}
```

## Worker Configuration

Configure the worker in `wrangler.toml`:

```toml
name = "my-game-websocket"
main = "index.ts"
compatibility_date = "2025-01-20"

[[durable_objects.bindings]]
name = "WEBSOCKET_SERVER"
class_name = "WebSocketServer"
script_name = "my-game-websocket"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketServer"]
```

## Development

### Local Development

```bash
# Terminal 1: Start the WebSocket worker
npm run dev:websocket

# Terminal 2: Start your game
npm run dev
```

### Testing

```bash
# Test WebSocket worker health
curl http://localhost:8787/health

# Test notification endpoint
curl -X POST http://localhost:8787/notify \
  -H "Content-Type: application/json" \
  -d '{"gameId":"test","message":{"type":"gameUpdate","gameState":{}}}'
```

## License

MIT
