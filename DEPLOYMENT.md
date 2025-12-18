# Deployment Guide

This guide explains how to deploy the games and their WebSocket infrastructure to Cloudflare.

## 🏗️ Architecture

The deployment consists of:

1. **WebSocket Worker** (Durable Objects) - Handles real-time connections (shared by all games)
2. **Separate Cloudflare Pages Projects** - Each game has its own Pages project:
   - World Conflict: `https://svelte-world-conflict.pages.dev/`
   - Galactic Conflict: `https://galactic-conflict.pages.dev/`

Each game communicates with the worker via HTTP (for notifications) and WebSocket (for real-time updates).

### Multi-Game Deployment Strategy

Each game is deployed as a **separate Cloudflare Pages project** with:
- **Independent builds**: Only rebuilds when its own code changes (via build watch paths)
- **Isolated code**: Each build only includes code from its package directory
- **Separate KV namespaces**: Each game uses its own KV storage
- **Shared WebSocket worker**: All games use the same worker for real-time communication

## 📋 Prerequisites

1. Cloudflare account (free tier works)
2. Wrangler CLI: `npm install -g wrangler`
3. Logged into Wrangler: `wrangler login`
4. KV namespaces created (see below)

## 🗄️ Step 1: Create KV Namespaces

Each game needs its own KV namespace. Create them using Wrangler:

### World Conflict KV Namespaces

```bash
# Create production namespace
wrangler kv:namespace create "WORLD_CONFLICT_KV"

# Create preview namespace
wrangler kv:namespace create "WORLD_CONFLICT_KV" --preview
```

Update the namespace IDs in `packages/world-conflict/wrangler.toml`:

```toml
[env.production]
kv_namespaces = [
    { binding = "WORLD_CONFLICT_KV", id = "your-production-id" }
]

[env.preview]
kv_namespaces = [
    { binding = "WORLD_CONFLICT_KV", id = "your-preview-id" }
]
```

### Galactic Conflict KV Namespaces

```bash
# Create production namespace
wrangler kv:namespace create "GALACTIC_CONFLICT_KV"

# Create preview namespace
wrangler kv:namespace create "GALACTIC_CONFLICT_KV" --preview
```

**Note:** For Cloudflare Pages deployments, KV bindings are configured in the dashboard (see Step 4), but you can keep these in `wrangler.toml` for local development.

## 🔌 Step 2: Deploy WebSocket Worker

The WebSocket worker must be deployed first since the game depends on it.

```bash
# Navigate to the worker directory
cd packages/multiplayer-framework/src/worker

# Deploy to Cloudflare
npx wrangler deploy
```

**Expected output:**
```
✨ Uploading...
✨ Deployment complete!
🌍  https://multiplayer-games-websocket.<your-subdomain>.workers.dev
```

**Important:** The worker name is configured as `multiplayer-games-websocket` to serve all multiplayer games. This creates a new worker deployment.

### Geographic Routing

The WebSocket worker uses **location hints** to ensure players from different countries can join the same game. All Durable Objects are routed to Western North America (`wnam`) by default, which ensures:

- ✅ Players from California, Japan, Europe, etc. can all join the same game
- ✅ Consistent routing across all Cloudflare datacenters
- ✅ Low-latency access for most users (especially in Americas and Asia-Pacific)

This is configured automatically in the worker code - no additional setup required.

### Verify Worker Deployment

Test the health endpoint:

```bash
curl https://multiplayer-games-websocket.<your-subdomain>.workers.dev/health
```

Expected response: `WebSocket worker is healthy`

## 🎮 Step 3: Set Up Cloudflare Pages Projects

Each game needs its own Cloudflare Pages project. You can set them up via the dashboard (recommended) or continue using Wrangler CLI for manual deployments.

### Option A: Cloudflare Dashboard (Recommended for CI/CD)

See the [Multi-Game Pages Setup](#-multi-game-pages-setup) section below for detailed instructions on setting up separate Pages projects with build watch paths.

### Option B: Manual Deployment via Wrangler CLI

#### Deploy World Conflict

```bash
# Navigate back to monorepo root
cd ../../../..

# Build and deploy the game
npm run deploy -w world-conflict
```

Or from the world-conflict directory:

```bash
cd packages/world-conflict
npm run build
npx wrangler pages deploy dist
```

**Expected output:**
```
✨ Success! Uploaded 123 files
✨ Deployment complete!
🌍  https://svelte-world-conflict.pages.dev
```

#### Event Processing

Galactic Conflict processes game events (armada arrivals, battles, etc.) automatically via client-side polling. When players are in a game, their browser calls the event processing API every 2 seconds. This is handled automatically by the game component - no additional setup required.

#### Deploy Galactic Conflict

```bash
cd packages/galactic-conflict
npm run build
npx wrangler pages deploy dist --project-name=galactic-conflict
```

**Note:** If you're using the dashboard setup, deployments happen automatically on git push.

## 🔧 Configuration

### WebSocket Worker URL

The game is pre-configured to use the shared worker URL in `packages/world-conflict/src/lib/websocket-config.ts`:

```typescript
export const WEBSOCKET_WORKER_URL = 
  'https://multiplayer-games-websocket.barrybecker4.workers.dev';
```

This configuration automatically:
- Uses `wss://` (secure WebSocket) in production
- Falls back to `ws://localhost:8787` in development

### Environment Variables

No additional environment variables are needed. Everything is configured via:
- KV bindings in `wrangler.toml`
- WebSocket URL in `websocket-config.ts`

## 🧪 Testing Deployment

### 1. Test WebSocket Worker

```bash
# Health check
curl https://multiplayer-games-websocket.barrybecker4.workers.dev/health

# Test notification endpoint
curl -X POST https://multiplayer-games-websocket.barrybecker4.workers.dev/notify \
  -H "Content-Type: application/json" \
  -d '{"gameId":"test","message":{"type":"gameUpdate","gameState":{}}}'
```

### 2. Test Game Deployment (Manual)

1. Visit your Cloudflare Pages URL
2. Create a new game
3. Verify WebSocket connection in browser console
4. Test making moves
5. Open in another browser/tab to test multiplayer

**Test Cross-Geographic Multiplayer:**
1. Create a new game in one location (e.g., California)
2. Share the game URL with a friend in another country (e.g., Japan)
3. Have them join the game
4. Both players should see real-time updates
5. Check browser console and worker logs for any routing issues

### 3. Test Game Deployment (Automated E2E Tests)

Run the full Playwright test suite against your deployed app:

```bash
cd packages/world-conflict
npx playwright test --config=playwright.config.production.ts
```

This will:
- Run all e2e tests against the deployed app
- Test multiplayer functionality with real WebSocket connections
- Verify game logic, turn order, AI players, and more
- Create real game data in your production KV storage

**Tips:**
- Use `--headed` flag to watch tests execute
- Use `--ui` flag for interactive debugging
- Run specific test files: `npx playwright test tests/e2e/single-human-ai.spec.ts --config=playwright.config.production.ts`
- See `packages/world-conflict/tests/e2e/README.md` for more options

### 4. Check Logs

View worker logs in real-time:

```bash
cd packages/multiplayer-framework/src/worker
npx wrangler tail
```

## 🎯 Multi-Game Pages Setup

This section explains how to set up separate Cloudflare Pages projects for each game, enabling automatic deployments and efficient builds.

### Step 1: Create Galactic Conflict Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Connect your repository (GitHub/GitLab)
4. Configure the project:
   - **Project name**: `galactic-conflict`
   - **Production branch**: `main` (or your default branch)
   - **Root directory**: `packages/galactic-conflict`
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `dist`
   - **Node version**: 18 or 20
5. Click **Save and Deploy**

### Step 2: Configure Build Watch Paths

Configure build watch paths so each project only rebuilds when its own code changes.

#### For World Conflict Project:

1. Go to your **svelte-world-conflict** Pages project
2. Navigate to **Settings** → **Builds**
3. Under **Build watch paths**, configure:
   - **Include paths:**
     - `packages/world-conflict/**`
     - `packages/multiplayer-framework/**` (shared dependency)
   - **Exclude paths:**
     - `packages/galactic-conflict/**`
     - `packages/*/node_modules/**`
     - `.git/**`

#### For Galactic Conflict Project:

1. Go to your **galactic-conflict** Pages project
2. Navigate to **Settings** → **Builds**
3. Under **Build watch paths**, configure:
   - **Include paths:**
     - `packages/galactic-conflict/**`
     - `packages/multiplayer-framework/**` (shared dependency)
   - **Exclude paths:**
     - `packages/world-conflict/**`
     - `packages/*/node_modules/**`
     - `.git/**`

### Step 3: Configure KV Namespace Bindings

Each Pages project needs its KV namespace bound in the dashboard.

#### For World Conflict:

1. Go to **svelte-world-conflict** Pages project
2. Navigate to **Settings** → **Functions** → **KV Namespace Bindings**
3. Click **Add binding**
4. Configure:
   - **Variable name**: `WORLD_CONFLICT_KV`
   - **KV namespace**: Select your `WORLD_CONFLICT_KV` namespace
5. Click **Save**

#### For Galactic Conflict:

1. Go to **galactic-conflict** Pages project
2. Navigate to **Settings** → **Functions** → **KV Namespace Bindings**
3. Click **Add binding**
4. Configure:
   - **Variable name**: `GALACTIC_CONFLICT_KV`
   - **KV namespace**: Select your `GALACTIC_CONFLICT_KV` namespace
   - If you don't have the namespace yet, create it first:
     ```bash
     wrangler kv:namespace create "GALACTIC_CONFLICT_KV"
     ```
5. Click **Save**

### Step 4: Verify Build Behavior

After setup, test that builds work correctly:

1. Make a change to `packages/world-conflict/src/routes/+page.svelte`
2. Push to your repository
3. Verify only the **world-conflict** project rebuilds
4. Make a change to `packages/galactic-conflict/src/routes/+page.svelte`
5. Push to your repository
6. Verify only the **galactic-conflict** project rebuilds

### Benefits of This Setup

- ✅ **Efficient builds**: Only rebuild what changed
- ✅ **Automatic deployments**: Deploy on every git push
- ✅ **Isolated builds**: Each build only includes its game's code
- ✅ **Independent scaling**: Each game can have different settings
- ✅ **Easy to add games**: Just create a new Pages project

## 🔄 Updating Deployments

### Update WebSocket Worker

```bash
cd packages/multiplayer-framework/src/worker
npx wrangler deploy
```

**Important:** After deploying with location hints, existing game sessions may need to be recreated. Players should create new games to ensure proper geographic routing.

### Update Games

If using dashboard setup with git integration, deployments happen automatically on push.

For manual deployments:

```bash
# World Conflict
npm run deploy -w world-conflict

# Galactic Conflict
cd packages/galactic-conflict && npm run build && npx wrangler pages deploy dist
```

## 🚨 Troubleshooting

### WebSocket Connection Fails

1. **Check worker is deployed:**
   ```bash
   curl https://multiplayer-games-websocket.barrybecker4.workers.dev/health
   ```

2. **Check browser console** for WebSocket errors

3. **Verify URL in config** matches deployed worker

### Players Can't Join from Different Countries

If players in different geographic locations (e.g., California and Japan) cannot join each other's games:

1. **Verify location hints are enabled** - Check that the worker code includes:
   ```typescript
   const durableObject = env.WEBSOCKET_SERVER.get(id, { locationHint: 'wnam' });
   ```

2. **Check worker logs** for routing errors:
   ```bash
   cd packages/multiplayer-framework/src/worker
   npx wrangler tail
   ```

3. **Test WebSocket connection** from both locations:
   - Check browser console for connection errors
   - Look for "WebSocket closed" or "Failed to connect" messages
   - Verify both players are connecting to the same gameId

4. **Alternative location hints** - If latency is poor for some regions, you can change the location hint in `worker/index.ts`:
   - `"wnam"` - Western North America (best for Americas + Asia-Pacific)
   - `"weur"` - Western Europe (best for Europe + Africa)
   - `"apac"` - Asia Pacific (best for Asia + Oceania)

**Note:** All players must connect after the location hint is deployed. Old game sessions may not work across regions.

### KV Storage Issues

1. **Verify KV namespace IDs** in `wrangler.toml`
2. **Check bindings** are correct in Cloudflare dashboard
3. **Test KV access** in development mode

### Deployment Errors

**"Class WebSocketServer not found":**
- The worker needs Durable Objects migration
- This is handled automatically in `wrangler.toml`
- Make sure you're using the correct account

**"KV namespace not found":**
- Create the namespace first (see Step 1)
- Update the ID in `wrangler.toml`

**"Pages deployment failed":**
- Check build output directory is `dist`
- Verify `npm run build` works locally
- Check build logs in Cloudflare dashboard

## 📊 Monitoring

### Cloudflare Dashboard

Monitor your deployments:
1. **Workers**: https://dash.cloudflare.com/workers
   - View WebSocket worker analytics
   - Check Durable Objects usage
   - Monitor request rates

2. **Pages**: https://dash.cloudflare.com/pages
   - View game deployment history
   - Check build logs
   - Monitor traffic

### Logs

Real-time worker logs:
```bash
cd packages/multiplayer-framework/src/worker
npx wrangler tail
```

Filter logs:
```bash
npx wrangler tail --status error
```

## 🔐 Security Notes

1. **CORS**: The worker allows all origins (`*`) by default. For production, consider restricting this in `worker/index.ts`:
   ```typescript
   const CORS_HEADERS = {
     'Access-Control-Allow-Origin': 'https://svelte-world-conflict.pages.dev',
     // ...
   };
   ```

2. **Rate Limiting**: Consider adding rate limiting to the worker for production use

3. **KV Data**: Game data is stored in KV. Consider:
   - Regular backups
   - Data cleanup for old games
   - Privacy considerations for player data

## 💡 Production Best Practices

1. **Use Custom Domains**: Set up custom domains in Cloudflare dashboard
2. **Enable Analytics**: Monitor usage and performance
3. **Set up Alerts**: Configure notifications for errors
4. **Regular Deploys**: Keep dependencies updated
5. **Monitor Costs**: Check Durable Objects and KV usage

## 🔗 Useful Links

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Docs](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

