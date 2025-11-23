# World Conflict

A real-time multiplayer strategy game built with SvelteKit, using the [@svelte-mp/framework](../svelte-multiplayer-framework) for WebSocket communication.

![World Conflict Gameplay](static/gameplay.png)

## 🎮 Features

- ✅ Real-time multiplayer gameplay (up to 4 players - AI or human)
- ✅ Strategic combat system inspired by Risk
- ✅ Persistent game state with Cloudflare KV
- ✅ Instant WebSocket updates via Durable Objects
- ✅ Global CDN distribution

## 🏗️ Architecture

- **Frontend**: SvelteKit app deployed on Cloudflare Pages
- **Real-time**: WebSocket Durable Objects from `@svelte-mp/framework`
- **Storage**: Cloudflare KV for persistent game data
- **Backend**: Cloudflare Workers with SvelteKit API routes
- **Deployment**: Fully serverless on Cloudflare

## 🚀 Development

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- Framework WebSocket worker deployed (see [framework docs](../svelte-multiplayer-framework/README.md))

### Quick Start

From the monorepo root:

```bash
# Install dependencies
npm install

# Start development (includes WebSocket worker)
npm run dev:full

# Or start just the game (worker runs separately)
npm run dev -w world-conflict
```

Open [http://localhost:5173](http://localhost:5173)

### Configuration

Update the WebSocket worker URL in `src/lib/websocket-config.ts`:

```typescript
export const WEBSOCKET_WORKER_URL = 'https://your-worker.workers.dev';
```

For local development, it defaults to `localhost:8787`.

## 🛠️ Development Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm test                 # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run check            # Type-check with svelte-check
npm run deploy           # Deploy to Cloudflare Pages
```

## 🎯 Project Structure

```
src/
├── lib/
│   ├── client/                    # Client-side code
│   │   ├── audio/                 # Sound system
│   │   ├── composables/           # Composable hooks
│   │   ├── feedback/              # Battle replay & tutorials
│   │   ├── gameController/        # Game state orchestration
│   │   ├── rendering/             # Battle animations
│   │   ├── stores/                # Svelte stores
│   │   └── websocket/             # WebSocket client wrapper
│   ├── components/                # Svelte components
│   │   ├── configuration/         # Game setup
│   │   ├── lobby/                 # Game lobby
│   │   ├── map/                   # Game map rendering
│   │   ├── modals/                # Modal dialogs
│   │   ├── ui/                    # Reusable UI components
│   │   └── waitingRoom/           # Pre-game waiting room
│   ├── game/                      # Core game logic
│   │   ├── commands/              # Game commands
│   │   ├── constants/             # Game constants
│   │   ├── entities/              # Game entities
│   │   ├── map/                   # Map generation
│   │   ├── mechanics/             # Game mechanics
│   │   └── validation/            # Move validation
│   └── server/                    # Server-side code
│       ├── ai/                    # AI opponents
│       └── storage/               # Storage layer (uses framework)
├── routes/                        # SvelteKit routes
│   ├── api/                       # API endpoints
│   │   └── game/                  # Game API routes
│   └── game/[gameId]/             # Game page
└── app.html                       # HTML template
```

## 🎮 How to Play

1. **Create a game** - Choose map size, player slots (human/AI/disabled)
2. **Wait for players** - Share the game link or start with AI
3. **Take turns** - Each turn you can:
   - Move armies between adjacent regions you control
   - Attack adjacent enemy regions
   - Build up forces in your regions
4. **Win conditions**:
   - Eliminate all opponents
   - Control the most territory when turn limit is reached

### Game Mechanics

- **Armies**: Each region has a number of armies
- **Combat**: Attacker and defender roll dice, armies are lost
- **Reinforcements**: Gain armies each turn based on territory controlled
- **Movement**: Can move armies between your regions multiple times per turn
- **Temples**: Special regions that provide bonuses

## 🔌 Framework Integration

World Conflict uses `@svelte-mp/framework` for real-time multiplayer:

```typescript
// WebSocket client wrapper
import { GameWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';

const client = new GameWebSocketClient();
await client.connect(gameId);

client.onGameUpdate((gameState) => {
  // Update UI with new game state
});
```

```typescript
// Storage wrapper
import { KVStorage } from '$lib/server/storage/KVStorage';

const storage = new KVStorage(platform);
const game = await storage.get(`wc_game:${gameId}`);
```

## 🚀 Deployment

### Deploy to Cloudflare Pages

1. **Build the application:**
   ```bash
   npm run build -w world-conflict
   ```

2. **Deploy to Pages:**
   ```bash
   npm run deploy -w world-conflict
   ```

3. **Configure KV binding:**
   
   In your Cloudflare Pages project settings, add a KV binding:
   - Variable name: `WORLD_CONFLICT_KV`
   - KV Namespace: Your created KV namespace

4. **Set worker URL:**
   
   Update `src/lib/websocket-config.ts` with your deployed worker URL.

## 🧪 Testing

```bash
# Unit tests
npm run test -w world-conflict

# E2E tests (requires build)
npm run test:e2e -w world-conflict

# Type checking
npm run check -w world-conflict
```

## 📝 License

MIT License - feel free to use this project as a starting point for your own multiplayer games!

## 🙏 Credits

- Original World Conflict game by Jakub Wasilewski
- Google Apps Script version by Barry Becker
- SvelteKit port and modernization by Barry Becker

