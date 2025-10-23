# Deployment Guide

This guide explains how to deploy the World Conflict game and its WebSocket infrastructure to Cloudflare.

## 🏗️ Architecture

The deployment consists of two separate Cloudflare services:

1. **WebSocket Worker** (Durable Objects) - Handles real-time connections
2. **World Conflict App** (Cloudflare Pages) - The game itself

The game communicates with the worker via HTTP (for notifications) and WebSocket (for real-time updates).

## 📋 Prerequisites

1. Cloudflare account (free tier works)
2. Wrangler CLI: `npm install -g wrangler`
3. Logged into Wrangler: `wrangler login`
4. KV namespaces created (see below)

## 🗄️ Step 1: Create KV Namespaces (If Needed)

If you don't have KV namespaces yet:

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

## 🔌 Step 2: Deploy WebSocket Worker

The WebSocket worker must be deployed first since the game depends on it.

```bash
# Navigate to the worker directory
cd packages/svelte-multiplayer-framework/src/worker

# Deploy to Cloudflare
npx wrangler deploy
```

**Expected output:**
```
✨ Uploading...
✨ Deployment complete!
🌍  https://svelte-world-conflict-websocket.<your-subdomain>.workers.dev
```

**Important:** The worker name is configured to match your existing deployment (`svelte-world-conflict-websocket`), so this will update your existing worker with the new framework code.

### Verify Worker Deployment

Test the health endpoint:

```bash
curl https://svelte-world-conflict-websocket.<your-subdomain>.workers.dev/health
```

Expected response: `WebSocket worker is healthy`

## 🎮 Step 3: Deploy World Conflict Game

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

## 🔧 Configuration

### WebSocket Worker URL

The game is pre-configured to use your existing worker URL in `packages/world-conflict/src/lib/websocket-config.ts`:

```typescript
export const WEBSOCKET_WORKER_URL = 
  'https://svelte-world-conflict-websocket.barrybecker4.workers.dev';
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
curl https://svelte-world-conflict-websocket.barrybecker4.workers.dev/health

# Test notification endpoint
curl -X POST https://svelte-world-conflict-websocket.barrybecker4.workers.dev/notify \
  -H "Content-Type: application/json" \
  -d '{"gameId":"test","message":{"type":"gameUpdate","gameState":{}}}'
```

### 2. Test Game Deployment

1. Visit your Cloudflare Pages URL
2. Create a new game
3. Verify WebSocket connection in browser console
4. Test making moves
5. Open in another browser/tab to test multiplayer

### 3. Check Logs

View worker logs in real-time:

```bash
cd packages/svelte-multiplayer-framework/src/worker
npx wrangler tail
```

## 🔄 Updating Deployments

### Update WebSocket Worker

```bash
cd packages/svelte-multiplayer-framework/src/worker
npx wrangler deploy
```

### Update Game

```bash
npm run deploy -w world-conflict
```

## 🚨 Troubleshooting

### WebSocket Connection Fails

1. **Check worker is deployed:**
   ```bash
   curl https://svelte-world-conflict-websocket.barrybecker4.workers.dev/health
   ```

2. **Check browser console** for WebSocket errors

3. **Verify URL in config** matches deployed worker

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
cd packages/svelte-multiplayer-framework/src/worker
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

