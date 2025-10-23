# Svelte World Conflict Monorepo

A real-time multiplayer strategy game built with SvelteKit and Cloudflare infrastructure. This monorepo contains both the **World Conflict** game and a reusable **Svelte Multiplayer Framework** extracted from it.

## 📦 Packages

### [`@svelte-mp/framework`](./packages/svelte-multiplayer-framework)

A minimal WebSocket framework for building real-time multiplayer Svelte games.

**Features:**
- Client WebSocket management with reconnection
- Server storage abstraction (Cloudflare KV included)
- Cloudflare Durable Objects worker for WebSocket sessions
- Type-safe and extensible
- Generic - works with any turn-based or real-time game

### [`world-conflict`](./packages/world-conflict)

The World Conflict strategy game - a modernized port from Google Apps Script.

**Features:**
- Real-time multiplayer (up to 4 players)
- Strategic combat system inspired by Risk
- AI opponents with different personalities
- Persistent game state
- Mobile-friendly interface

## 🚀 Quick Start

### Installation

Install all dependencies from the root:

```bash
npm install
```

This will automatically install dependencies for all packages in the workspace.

### Development

**Option 1: Start World Conflict only** (WebSocket worker runs separately)

```bash
# Terminal 1: Start the WebSocket worker
npm run dev:websocket

# Terminal 2: Start World Conflict
npm run dev
```

**Option 2: Start everything with concurrently**

```bash
npm run dev:full
```

Then open [http://localhost:5173](http://localhost:5173)

### Building

Build all packages:

```bash
npm run build
```

Or build individual packages:

```bash
npm run build -w @svelte-mp/framework
npm run build -w world-conflict
```

## 🏗️ Monorepo Structure

```
svelte-world-conflict/
├── packages/
│   ├── svelte-multiplayer-framework/   # Reusable WebSocket framework
│   │   ├── src/
│   │   │   ├── client/                 # WebSocket client
│   │   │   ├── server/                 # Storage adapters
│   │   │   ├── worker/                 # Cloudflare Durable Objects worker
│   │   │   └── shared/                 # Shared types and utilities
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── world-conflict/                 # World Conflict game
│       ├── src/                        # Game source code
│       ├── static/                     # Static assets
│       ├── package.json
│       └── README.md
│
├── package.json                        # Root workspace config
├── ARCHITECTURE.md                     # Architecture documentation
└── README.md                           # This file
```

## 🛠️ Available Scripts

From the root directory:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start World Conflict dev server |
| `npm run dev:full` | Start WebSocket worker + World Conflict |
| `npm run dev:websocket` | Start WebSocket worker only |
| `npm run build` | Build all packages |
| `npm run deploy:worker` | Deploy WebSocket worker to Cloudflare |
| `npm test` | Run tests in all packages |
| `npm run format` | Format code in all packages |
| `npm run lint` | Lint code in all packages |

### Package-Specific Scripts

Run commands in a specific package:

```bash
# Run dev server in world-conflict package
npm run dev -w world-conflict

# Build only the framework
npm run build -w @svelte-mp/framework

# Run tests in a specific package
npm run test -w world-conflict
```

## 🎯 Using the Framework in Your Own Game

The framework is designed to be reusable. Here's how to use it:

1. **Deploy the WebSocket worker:**
   ```bash
   cd packages/svelte-multiplayer-framework/src/worker
   npx wrangler deploy
   ```

2. **Add the framework to your project:**
   ```bash
   npm install @svelte-mp/framework
   ```

3. **Use in your code:**
   ```typescript
   import { WebSocketClient } from '@svelte-mp/framework/client';
   import { KVStorageAdapter } from '@svelte-mp/framework/server';
   ```

See the [framework README](./packages/svelte-multiplayer-framework/README.md) for detailed usage examples.

## 🚀 Deployment to Cloudflare

### Quick Deploy

```bash
# 1. Deploy WebSocket worker (required first)
cd packages/svelte-multiplayer-framework/src/worker
npx wrangler deploy

# 2. Deploy the game
cd ../../..
npm run deploy -w world-conflict
```

### Full Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions including:
- KV namespace setup
- Worker configuration
- Testing and troubleshooting
- Production best practices
- Monitoring and logs

The deployment guide covers both initial setup and updates.

## 🎮 How to Play World Conflict

World Conflict is a strategic multiplayer game where players:

1. **Conquer territories** by moving armies between regions
2. **Build up forces** to strengthen your position
3. **Attack opponents** to expand your territory
4. **Win by elimination** or controlling the most territory

## 📚 Documentation

- [Framework Documentation](./packages/svelte-multiplayer-framework/README.md) - How to use the multiplayer framework
- [World Conflict Documentation](./packages/world-conflict/README.md) - Game-specific documentation
- [Architecture Guide](./ARCHITECTURE.md) - System architecture and design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev:full`
5. Submit a pull request

## 📝 License

MIT License - feel free to use this project as a starting point for your own multiplayer games!

## 🙏 Credits

- Original World Conflict game by Jakub Wasilewski
- Google Apps Script version by Barry Becker
- SvelteKit port, modernization, and framework extraction by Barry Becker (with help from Claude AI)

---

**Framework Status**: ✅ Ready for use  
**Game Status**: 🚧 Active development
