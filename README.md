# Svelte Multiplayer Games Monorepo

A collection of real-time multiplayer games built with SvelteKit and Cloudflare infrastructure. This monorepo contains multiple multiplayer games and a reusable **Svelte Multiplayer Framework** that powers them.

## 📦 Packages

### [`multiplayer-framework`](./packages/multiplayer-framework)

A minimal WebSocket framework for building real-time multiplayer games.

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

Each game requires the WebSocket worker to be running. You can start them separately or together:

**Option 1: Start worker and game separately**

```bash
# Terminal 1: Start the WebSocket worker
npm run dev:websocket

# Terminal 2: Start a game (specify workspace)
npm run dev -w world-conflict
# or
npm run dev -w galactic-conflict
```

**Option 2: Start everything with concurrently**

```bash
npm run dev:full
```

Then open the game URL (typically [http://localhost:5173](http://localhost:5173))

See individual game READMEs for game-specific development instructions.

### Building

Build all packages:

```bash
npm run build
```

Or build individual packages:

```bash
npm run build -w multiplayer-framework
npm run build -w world-conflict
npm run build -w galactic-conflict
```

## 🏗️ Monorepo Structure

```
svelte-world-conflict/
├── packages/
│   ├── multiplayer-framework/          # Reusable WebSocket framework
│   │   ├── src/
│   │   │   ├── client/                 # WebSocket client
│   │   │   ├── server/                 # Storage adapters
│   │   │   ├── worker/                 # Cloudflare Durable Objects worker
│   │   │   └── shared/                 # Shared types and utilities
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── world-conflict/                 # World Conflict game
│   │   ├── src/                        # Game source code
│   │   ├── static/                     # Static assets
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── galactic-conflict/              # Galactic Conflict game
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
| `npm run dev -w <package>` | Start a game dev server (requires workspace flag) |
| `npm run dev:full` | Start WebSocket worker + default game |
| `npm run dev:websocket` | Start WebSocket worker only |
| `npm run build` | Build all packages |
| `npm run deploy:worker` | Deploy WebSocket worker to Cloudflare |
| `npm test` | Run tests in all packages |
| `npm run format` | Format code in all packages |
| `npm run lint` | Lint code in all packages |

### Package-Specific Scripts

Run commands in a specific package:

```bash
# Run dev server for a game
npm run dev -w world-conflict
npm run dev -w galactic-conflict

# Build only the framework
npm run build -w multiplayer-framework

# Run tests in a specific package
npm run test -w world-conflict
npm run test -w galactic-conflict
```

## 🎯 Using the Framework in Your Own Game

The framework is designed to be reusable. Here's how to use it:

1. **Deploy the WebSocket worker:**
   ```bash
   cd packages/multiplayer-framework/src/worker
   npx wrangler deploy
   ```

2. **Add the framework to your project:**
   ```bash
   npm install multiplayer-framework
   ```

3. **Use in your code:**
   ```typescript
   import { WebSocketClient } from 'multiplayer-framework/client';
   import { KVStorageAdapter } from 'multiplayer-framework/server';
   ```

See the [framework README](./packages/multiplayer-framework/README.md) for detailed usage examples.

## 🚀 Deployment to Cloudflare

### Quick Deploy

```bash
# 1. Deploy WebSocket worker (required first)
cd packages/multiplayer-framework/src/worker
npx wrangler deploy

# 2. Deploy a game
cd ../../..
npm run deploy -w world-conflict
# or
npm run deploy -w galactic-conflict
```

### Full Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions including:
- KV namespace setup
- Worker configuration
- Multi-game deployment strategy
- Testing and troubleshooting
- Production best practices
- Monitoring and logs

The deployment guide covers both initial setup and updates. See individual game READMEs for game-specific deployment details.

## 📚 Documentation

- [Framework Documentation](./packages/multiplayer-framework/README.md) - How to use the multiplayer framework
- [World Conflict Documentation](./packages/world-conflict/README.md) - World Conflict game documentation
- [Galactic Conflict Documentation](./packages/galactic-conflict/README.md) - Galactic Conflict game documentation
- [Architecture Guide](./ARCHITECTURE.md) - System architecture and design
- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions

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
- SvelteKit port, modernization, framework extraction, and additional games by Barry Becker (with help from Claude AI)

---

**Framework Status**: ✅ Ready for use  
**Game Status**: 🚧 Active development
