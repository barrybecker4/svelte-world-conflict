# World Conflict Game Architecture

## 📦 Monorepo Structure

This repository is organized as a monorepo with two main packages:

```
svelte-world-conflict/
├── packages/
│   ├── svelte-multiplayer-framework/    # Reusable WebSocket framework
│   │   ├── src/
│   │   │   ├── client/                  # WebSocket client
│   │   │   ├── server/                  # Storage adapters
│   │   │   ├── worker/                  # Cloudflare Durable Objects worker
│   │   │   └── shared/                  # Shared types and utilities
│   │   └── package.json
│   │
│   └── world-conflict/                  # World Conflict game
│       ├── src/
│       │   ├── lib/
│       │   │   ├── client/              # Client-side game code
│       │   │   ├── components/          # Svelte components
│       │   │   ├── game/                # Core game logic
│       │   │   └── server/              # Server-side game code
│       │   └── routes/                  # SvelteKit routes & API
│       └── package.json
│
└── package.json                         # Root workspace configuration
```

### Framework Package Scope

The `@svelte-mp/framework` provides generic multiplayer infrastructure:

- **Client**: WebSocket connection management, reconnection, keep-alive
- **Server**: Storage abstraction with Cloudflare KV implementation
- **Worker**: Durable Objects server for WebSocket session management
- **Shared**: Type definitions and configuration utilities

**Not included** (game-specific, stays in World Conflict):
- Lobby/waiting room UI
- Game state management
- Turn management
- Battle animations
- AI opponents

## 🏗️ Overall System Architecture

The World Conflict game is built on a modern serverless architecture using Cloudflare's ecosystem:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            World Conflict Game                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────┐     ┌──────────────────┐                        │
│  │   SvelteKit App     │     │   Cloudflare     │                        │
│  │   (Frontend)        │────▶│   Pages/Workers  │                        │
│  │                     │     │                  │                        │
│  │ • Game UI           │     │ • API Routes     │                        │
│  │ • State Management  │     │ • Game Logic     │                        │
│  │ • Uses Framework    │     │ • Player mgmt    │                        │
│  │   WebSocket Client  │     │ • Uses Framework │                        │
│  └──────────┬──────────┘     │   KV Storage     │                        │
│             │                └────────┬─────────┘                        │
│             │                         │                                   │
└─────────────┼─────────────────────────┼───────────────────────────────────┘
              │                         │
              │ WebSocket               │ HTTP Notifications
              │                         │
┌─────────────┼─────────────────────────┼───────────────────────────────────┐
│             │    @svelte-mp/framework │                                   │
├─────────────┼─────────────────────────┼───────────────────────────────────┤
│             │                         │                                   │
│  ┌──────────▼──────────┐     ┌────────▼────────┐     ┌─────────────────┐ │
│  │  WebSocket Worker   │     │  KV Storage     │     │  Cloudflare KV  │ │
│  │  (Durable Objects)  │◄────┤  Adapter        │────▶│                 │ │
│  │                     │     │                 │     │ • Game records  │ │
│  │ • Real-time updates │     │ • Abstract      │     │ • Persistent    │ │
│  │ • Session mgmt      │     │   interface     │     │   state storage │ │
│  │ • Message routing   │     │ • KV impl       │     └─────────────────┘ │
│  │ • Broadcasting      │     └─────────────────┘                         │
│  └─────────────────────┘                                                 │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key:**
- **Top section**: Game-specific code (World Conflict)
- **Bottom section**: Reusable framework (@svelte-mp/framework)
- **Boundary**: Clear separation allows framework reuse in other games

## 🔄 Real-time Communication Flow

```
┌─────────────┐     WebSocket     ┌──────────────────┐     HTTP POST     ┌─────────────┐
│   Client    │◄─────────────────▶│  Durable Object  │◄─────────────────▶│   Worker    │
│             │    messages       │  (per game)      │   notifications   │             │
│ • Game UI   │                   │                  │                   │ • API       │
│ • Actions   │                   │ • Session mgmt   │                   │ • Logic     │
│ • Updates   │                   │ • Message relay  │                   │ • Storage   │
└─────────────┘                   └──────────────────┘                   └─────────────┘
       │                                   │                                     │
       └─── Game Actions ─────────────────────────────────────────────────────────┘
            (moves, joins, etc.)
```

## 🎮 Game State Management Architecture

### Core Components

```
GameState (Central Hub)
├── State Data
│   ├── turnNumber: number
│   ├── playerSlotIndex: number
│   ├── movesRemaining: number
│   ├── players: Player[]
│   ├── regions: Region[]
│   ├── ownersByRegion: { [regionIndex]: playerSlotIndex }
│   └── soldiersByRegion: { [regionIndex]: number }
│
├── Player Management
│   ├── getCurrentPlayer() → finds by slot index
│   ├── getPlayerBySlot(slotIndex)
│   └── activePlayer() → wrapper for getCurrentPlayer
│
└── Game Operations
    ├── Move validation
    ├── Combat resolution
    ├── Turn advancement
    └── Win condition checks
```


### WebSocket Message Flow:
```
Game Action (move, attack, etc.)
       │
       ▼
API Endpoint (/api/game/[gameId]/move)
       │
       ▼
GameState Update
       │
       ▼
Save to KV Storage
       │
       ▼
WebSocket Notification to Durable Object
       │
       ▼
Broadcast to All Connected Clients
       │
       ▼
Client UI Updates
```

