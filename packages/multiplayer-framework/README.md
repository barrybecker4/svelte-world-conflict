# Multiplayer WebSocket Framework

A minimal, framework-agnostic WebSocket library for building multiplayer games with Cloudflare infrastructure. 
Works with any JavaScript framework (Svelte, React, Vue, vanilla JS, etc.).

## Features

- **Client WebSocket Management** - Robust connection handling with automatic reconnection
- **Server Storage Abstraction** - Pluggable storage adapters (Cloudflare KV included)
- **Cloudflare Durable Objects Worker** - Scalable WebSocket server with session management
- **Type-Safe** - Full TypeScript support with generics for game state and message types
- **Minimal & Generic** - No game-specific logic, works with any turn-based or real-time game

## Installation

This package is part of a monorepo. Install dependencies from the root:

```bash
npm install
```

## Quick Start

### 1. Deploy the WebSocket Worker

```bash
cd packages/multiplayer-framework/src/worker
npx wrangler deploy
```

Note the deployed worker URL (e.g., `your-worker.workers.dev`)

### 2. Define Your Game Types

```typescript
// types.ts - Define your game's state and message types
import type { BaseMessage } from 'multiplayer-framework/shared';

// Your game state type
export interface MyGameState {
  board: string[][];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  turnNumber: number;
}

// Your custom message types (extend BaseMessage)
export interface MoveMessage extends BaseMessage {
  type: 'move';
  position: { x: number; y: number };
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  text: string;
  sender: string;
}

// Union of all your outgoing message types
export type GameMessage = MoveMessage | ChatMessage;
```

### 3. Client Setup with Type Safety

```typescript
import { WebSocketClient } from 'multiplayer-framework/client';
import type { WebSocketConfig } from 'multiplayer-framework/shared';
import type { MyGameState, GameMessage } from './types';

// Configure your worker URL
const config: WebSocketConfig = {
  workerUrl: 'your-worker.workers.dev',
  localHost: 'localhost:8787' // for local development
};

// Create a fully typed client
const client = new WebSocketClient<MyGameState, GameMessage>(config);

// Connect to a game
await client.connect('game-123');

// Listen for game updates - gameState is typed as MyGameState
client.onGameUpdate((gameState) => {
  console.log('Current player:', gameState.currentPlayer); // ✓ Type-safe
  console.log('Turn:', gameState.turnNumber); // ✓ Type-safe
});

// Send typed messages - TypeScript ensures correct message shape
client.send({
  type: 'move',
  position: { x: 0, y: 1 }
});

// Custom message handlers with typed payloads
client.on<{ text: string }>('chat', (data) => {
  console.log('Chat received:', data.text); // ✓ Type-safe
});

// Disconnect when done
client.disconnect();
```

### 4. Server Setup

```typescript
// Example using any backend framework (SvelteKit, Express, Hono, etc.)
import { KVStorageAdapter } from 'multiplayer-framework/server';
import type { GameUpdateMessage, NotificationPayload } from 'multiplayer-framework/shared';
import type { MyGameState } from './types';

// Define your game record type
interface GameRecord {
  gameId: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  gameState: MyGameState;
}

export async function POST({ request, platform, params }) {
  // Initialize storage - extract the KV binding from platform
  const kv = platform?.env?.YOUR_KV_NAMESPACE;
  const storage = new KVStorageAdapter(kv, 'YOUR_KV_NAMESPACE');

  // Load game state with proper typing
  const gameId = params.gameId;
  const game = await storage.get<GameRecord>(`game:${gameId}`);
  
  if (!game) {
    return json({ error: 'Game not found' }, { status: 404 });
  }

  // Process move and update state (your game logic)
  const updatedGameState: MyGameState = {
    ...game.gameState,
    // ... apply move logic
  };

  // Save updated state with type safety
  await storage.put<GameRecord>(`game:${gameId}`, {
    ...game,
    gameState: updatedGameState
  });

  // Notify all connected clients via WebSocket worker
  await notifyClients<MyGameState>(gameId, {
    type: 'gameUpdate',
    gameId,
    gameState: updatedGameState
  });

  return json({ success: true });
}

async function notifyClients<TGameState>(
  gameId: string, 
  message: GameUpdateMessage<TGameState>
): Promise<void> {
  const workerUrl = 'https://your-worker.workers.dev/notify';
  const payload: NotificationPayload<GameUpdateMessage<TGameState>> = {
    gameId,
    message
  };
  
  await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

## Architecture

```
┌─────────────────┐     WebSocket     ┌──────────────────┐     HTTP      ┌─────────────────┐
│   Game Client   │◄─────────────────►│  Durable Object  │◄────────────► │   API Server    │
│  (any framework)│    real-time      │  (per game)      │ notifications │  (any backend)  │
│ • Game UI       │                   │                  │               │                 │
│ • WebSocket     │                   │ • Session mgmt   │               │ • Game Logic    │
│   Client<T>     │                   │ • Broadcasting   │               │ • Storage<T>    │
└─────────────────┘                   └──────────────────┘               └─────────────────┘
```

## API Reference

### Client

#### `WebSocketClient<TGameState, TOutgoingMessage>`

A generic WebSocket client for multiplayer communication.

**Type Parameters:**
- `TGameState` - The type of game state received from the server (default: `unknown`)
- `TOutgoingMessage` - The type of messages that can be sent (must extend `BaseMessage`, default: `BaseMessage`)

```typescript
class WebSocketClient<TGameState = unknown, TOutgoingMessage extends BaseMessage = BaseMessage> {
  constructor(config: WebSocketConfig, playerId?: string);
  
  // Connection state
  readonly connected: boolean;  // Current connection state
  onConnectionChange(callback: (connected: boolean) => void): () => void;  // Returns unsubscribe fn
  
  // Connection management
  connect(gameId: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  startKeepAlive(intervalMs?: number): void;
  
  // Send typed messages
  send(message: TOutgoingMessage): void;
  
  // Standard event handlers with typed game state
  onGameUpdate(callback: (data: TGameState) => void): void;
  onGameStarted(callback: (data: TGameState) => void): void;
  onPlayerJoined(callback: (data: TGameState) => void): void;
  onGameEnded(callback: (data: TGameState) => void): void;
  onError(callback: (error: string) => void): void;
  onConnected(callback: () => void): void;
  onDisconnected(callback: () => void): void;
  
  // Custom message types with typed payloads
  on<TPayload>(messageType: string, callback: (data: TPayload) => void): void;
}
```

### Server

#### `StorageAdapter` Interface

```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<{ keys: Array<{ name: string }> }>;
  getStorageInfo(): StorageInfo;
}
```

#### `KVStorageAdapter`

```typescript
class KVStorageAdapter implements StorageAdapter {
  constructor(platform: KVPlatform, config: KVStorageConfig);
  // Implements all StorageAdapter methods with full type safety
}
```

### Message Types

The framework defines standard message types with generics for type safety:

```typescript
// Base message - all messages extend this
interface BaseMessage {
  type: string;
  timestamp?: number;
}

// Game state messages - generic over game state type
interface GameStateMessage<TGameState> extends BaseMessage {
  gameId: string;
  gameState: TGameState;
}

// Standard messages
interface GameUpdateMessage<TGameState> extends GameStateMessage<TGameState> {
  type: 'gameUpdate';
}

interface GameStartedMessage<TGameState> extends GameStateMessage<TGameState> {
  type: 'gameStarted';
}

interface PlayerJoinedMessage<TGameState> extends GameStateMessage<TGameState> {
  type: 'playerJoined';
}

interface GameEndedMessage<TGameState> extends GameStateMessage<TGameState> {
  type: 'gameEnded';
}

// Framework messages (no game state)
interface SubscribeMessage extends BaseMessage {
  type: 'subscribe';
  gameId: string;
  playerId?: string;
}

interface PingMessage extends BaseMessage {
  type: 'ping';
  timestamp: number;
}

interface PongMessage extends BaseMessage {
  type: 'pong';
  timestamp: number;
}

interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
}

// Notification payload for HTTP notifications
interface NotificationPayload<TMessage extends BaseMessage = BaseMessage> {
  gameId: string;
  message: TMessage;
}
```

### Type Guards

The framework provides type guards for runtime type checking:

```typescript
import { isGameStateMessage, isErrorMessage } from 'multiplayer-framework/shared';

// Check if a message contains game state
if (isGameStateMessage<MyGameState>(message)) {
  console.log(message.gameState); // Typed as MyGameState
}

// Check if a message is an error
if (isErrorMessage(message)) {
  console.log(message.error);
}
```

## Example: Type-Safe Tic-Tac-Toe

Here's a complete example with full type safety:

```typescript
// types.ts
import type { BaseMessage } from 'multiplayer-framework/shared';

export interface TicTacToeState {
  board: (string | null)[][];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  gameOver: boolean;
}

export interface MoveMessage extends BaseMessage {
  type: 'move';
  position: { x: number; y: number };
}

// client.ts
import { WebSocketClient } from 'multiplayer-framework/client';
import type { TicTacToeState, MoveMessage } from './types';

const client = new WebSocketClient<TicTacToeState, MoveMessage>({
  workerUrl: 'tic-tac-toe-ws.workers.dev'
});

await client.connect('game-123');

client.onGameUpdate((state) => {
  renderBoard(state.board); // ✓ Type-safe
  showCurrentPlayer(state.currentPlayer); // ✓ Type-safe
  
  if (state.winner) {
    showWinner(state.winner);
  }
});

function makeMove(x: number, y: number): void {
  client.send({
    type: 'move',
    position: { x, y }
  }); // ✓ Type-safe - TypeScript ensures this matches MoveMessage
}

// server API route
import { KVStorageAdapter } from 'multiplayer-framework/server';
import type { GameUpdateMessage } from 'multiplayer-framework/shared';
import type { TicTacToeState } from '$lib/types';

interface GameRecord {
  gameId: string;
  state: TicTacToeState;
}

export async function POST({ request, platform }) {
  const storage = new KVStorageAdapter(platform?.env?.TTT_KV, 'TTT_KV');
  const { gameId, position } = await request.json();
  
  const game = await storage.get<GameRecord>(`game:${gameId}`);
  if (!game) return json({ error: 'Not found' }, { status: 404 });
  
  // Apply move (your game logic)
  game.state.board[position.x][position.y] = game.state.currentPlayer;
  game.state.currentPlayer = game.state.currentPlayer === 'X' ? 'O' : 'X';
  
  await storage.put<GameRecord>(`game:${gameId}`, game);
  
  // Notify all players with typed message
  const notification: GameUpdateMessage<TicTacToeState> = {
    type: 'gameUpdate',
    gameId,
    gameState: game.state
  };
  
  await fetch('https://tic-tac-toe-ws.workers.dev/notify', {
    method: 'POST',
    body: JSON.stringify({ gameId, message: notification })
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
