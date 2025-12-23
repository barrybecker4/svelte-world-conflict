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

### [`shared-ui`](./packages/shared-ui)

Shared Svelte UI components used across all games.

**Features:**
- Reusable UI components (Button, Modal, Panel, Spinner, etc.)
- Chart components (LineChart with Chart.js)
- Audio components (AudioButton, SoundTestModal)
- Consistent styling and behavior
- Source-level sharing (no build step required)

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

### Logging Configuration

The logger supports configurable log levels via environment variables. This allows you to control the verbosity of logs during development and production.

**Available Log Levels:**
- `DEBUG` - Shows all logs including DEBUG (only if `isDev` is also true), INFO, WARN, and ERROR
- `INFO` - Shows INFO, WARN, and ERROR logs (default)
- `WARN` - Shows WARN and ERROR logs only
- `ERROR` - Shows ERROR logs only

**Setting Log Level:**

For client-side code (browser):
```bash
# In your .env file or environment
VITE_LOG_LEVEL=DEBUG
```

For server-side code (Node.js/Cloudflare Workers):
```bash
# In your .env file or environment
LOG_LEVEL=INFO
```

**Examples:**
```bash
# Development with verbose logging
VITE_LOG_LEVEL=DEBUG npm run dev -w world-conflict

# Production with minimal logging
LOG_LEVEL=WARN npm run build -w world-conflict
```

**Note:** DEBUG logs will only appear if both `LOG_LEVEL=DEBUG` (or `VITE_LOG_LEVEL=DEBUG`) is set AND the code is running in development mode (`NODE_ENV=development` or Vite dev mode).

### Ad Monetization

All games support Google AdSense display advertising. To enable ads:

1. **Get your AdSense Publisher ID:**
   - Sign up at https://www.google.com/adsense
   - Your publisher ID format: `ca-pub-XXXXXXXXXXXXXXXX`
   - See [How to Get Your AdSense Publisher ID](#how-to-get-your-adsense-publisher-id) below for detailed steps

2. **Create Ad Units:**
   - Create display ad units in your AdSense account
   - Note the ad unit IDs (numeric values)

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```bash
   # Required: Your AdSense publisher ID
   VITE_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXXXXXXXX
   
   # Required: Your ad unit ID
   VITE_ADSENSE_AD_UNIT_ID=1234567890
   
   # Optional: Enable/disable ads (default: enabled if publisher ID is set)
   VITE_ADSENSE_ENABLED=true
   ```

4. **Ad Placement:**
   - Desktop: Sidebar ads (300x250) on game pages and lobby
   - Mobile: Bottom banner ads (728x90 horizontal, 320x50 on small screens)
   - Waiting room: Rectangle ads (300x250)

Ads are automatically hidden if:
- Publisher ID is not configured
- Ad blockers are detected (gracefully handled)
- Game summary/end screen is displayed
- Game is completed

#### How to Get Your AdSense Publisher ID

1. **Sign Up for Google AdSense:**
   - Go to https://www.google.com/adsense
   - Sign in with your Google account
   - Click "Get Started"

2. **Add Your Website:**
   - Enter your website URL (e.g., `https://your-game-domain.pages.dev`)

3. **Complete Account Setup:**
   - Provide payment information
   - Verify your identity (may require ID verification)
   - Accept the AdSense terms

4. **Get Your Publisher ID:**
   - After approval, go to your AdSense dashboard
   - Click "Account" → "Account information"
   - Your Publisher ID is shown as `ca-pub-XXXXXXXXXXXXXXXX` (16 digits)
   - Copy this value

5. **Create Ad Units:**
   - Go to "Ads" → "By ad unit" → "Display ads"
   - Click "Create ad unit"
   - Choose "Display ads"
   - Configure:
     - Name (e.g., "Game Sidebar Ad")
     - Ad size (e.g., "Responsive" or "300x250")
   - Click "Create"
   - Copy the Ad Unit ID (numeric value, e.g., `1234567890`)

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

**Note:** The `shared-ui` package doesn't require a separate build step. Its components are compiled as part of each game's build process through Vite's alias configuration.

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
│   ├── shared-ui/                      # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/                 # Base UI components
│   │   │   │   ├── charts/             # Chart components
│   │   │   │   ├── audio/              # Audio components
│   │   │   │   └── modals/             # Modal components
│   │   │   ├── index.ts                # Barrel exports
│   │   │   └── types.ts                # Shared types
│   │   ├── package.json
│   │   └── tsconfig.json
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
- [Shared UI Components](./packages/shared-ui/) - Reusable UI components for games
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
