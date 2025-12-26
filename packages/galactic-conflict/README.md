# Galactic Conflict

A real-time multiplayer space strategy game built with SvelteKit, using the [multiplayer-framework](../multiplayer-framework) for WebSocket communication.

## Features

- Real-time multiplayer gameplay (up to 20 players - AI or human)
- Concurrent gameplay - no turns, all players act simultaneously
- Conquer planets with armadas of spaceships
- Resource generation based on planet volume
- Risk-style dice combat mechanics
- Persistent game state with Cloudflare KV
- Instant WebSocket updates via Durable Objects

## Architecture

- **Frontend**: SvelteKit app deployed on Cloudflare Pages
- **Real-time**: WebSocket Durable Objects from `multiplayer-framework`
- **Storage**: Cloudflare KV for persistent game data
- **Backend**: Cloudflare Workers with SvelteKit API routes
- **Event Processing**: Client-side polling (every 2 seconds) triggers server-side event processing
- **Deployment**: Fully serverless on Cloudflare

### Event Processing

Game events (armada arrivals, battles, resource ticks) are processed automatically by client-side polling that calls the server API every 2 seconds. This ensures:
- Events are processed server-side for all active games
- Works reliably without requiring cron triggers or external services
- Simple and maintainable approach

## Development

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- Framework WebSocket worker deployed (see [framework docs](../multiplayer-framework/README.md))

### Quick Start

The game **requires** the WebSocket worker to be running. You need **two terminals**:

```bash
# Terminal 1: Start the WebSocket worker (REQUIRED)
cd packages/galactic-conflict
npm run dev:websocket

# Terminal 2: Start the game
cd packages/galactic-conflict  
npm run dev
```

Or run both together (requires `npm install` first):

```bash
cd packages/galactic-conflict
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173)

> **Note:** The game will fail fast if the WebSocket worker is not running. This is intentional - there is no HTTP polling fallback. Real-time WebSocket communication is required for gameplay.

### With Cloudflare KV (for persistent storage and cron triggers)

**Important**: Cron triggers only work when using `wrangler pages dev` or in production. They do not work with `vite dev`.

**Option 1: Build and serve with wrangler** (supports cron triggers):
```bash
npm run build
npm run preview
```

**Option 2: For development without cron triggers** (faster iteration):
```bash
npm run dev
```

**Note**: In production, cron triggers run automatically every 2 seconds to process game events (armada arrivals, battles). For local testing of cron triggers, you need to build and use `wrangler pages dev`.

## Game Mechanics

### Planets
- Each planet has a volume (5-100) that determines:
  - Visual radius (cube root of volume)
  - Resource production (volume resources per minute)
- Planets can be owned by players or neutral

### Armadas
- Groups of spaceships sent from one planet to another
- Travel at configurable speed (10-1000 units per minute)
- Arrival time depends on distance between planets
- Reinforcement: arrive at friendly planet → add ships
- Attack: arrive at enemy/neutral planet → battle

### Battles
- Risk-style dice combat
- Multiple players can fight at the same planet
- Multi-player resolution: all players gang up on weakest until eliminated
- Battle continues until one player remains

### Resources
- Planets generate resources every minute
- Resources can be spent to build ships at owned planets
- Ship cost is configurable

### Victory Conditions
- Game ends when time expires or one player remains
- Winner is determined by:
  1. Most planets owned
  2. Tiebreaker: most ships
  3. Tiebreaker: most resources

### Player Elimination
- A player is eliminated when they have no planets AND no ships
- Players with in-transit armadas can still win by conquering a planet

## Configuration

Game settings are configurable:
- Number of planets: 5-100
- Game duration: 1-60 minutes
- Armada speed: 10-1000 units/minute
- State broadcast interval: 1-10 seconds

### Google AdSense

The Google AdSense Publisher ID is configured in `src/app.html` as a meta tag. The AdSense script in `src/routes/+layout.svelte` automatically extracts the Publisher ID from this meta tag, so you only need to update it in one place.

## License

MIT License
