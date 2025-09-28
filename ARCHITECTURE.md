# World Conflict Game Architecture

## 🏗️ Overall System Architecture

The World Conflict game is built on a modern serverless architecture using Cloudflare's ecosystem:

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   SvelteKit App     │────▶│   Cloudflare     │────▶│   WebSocket Worker  │
│   (Frontend)        │     │   Pages/Workers  │     │   (Durable Objects) │
│                     │     │                  │     │                     │
│ • Game UI           │     │ • API Routes     │     │ • Real-time updates │
│ • State Management  │     │ • Game Logic     │     │ • Session mgmt      │
│ • WebSocket Client  │     │ • Player mgmt    │     │ • Message routing   │
└─────────────────────┘     └──────────────────┘     └─────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────┐
                            │  Cloudflare KV   │
                            │                  │
                            │ • Game records   │
                            │ • Persistent     │
                            │   state storage  │
                            └──────────────────┘
```

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

