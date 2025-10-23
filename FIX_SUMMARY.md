# AI Turn WebSocket Update Fix + workerUrl Error Fix

## Summary

You were correct! The AI players were making moves on the server, but the WebSocket notifications weren't reaching the client in production. After a page refresh, you could see the moves because they were stored in the database.

## Update: New Error Found

After your first deployment, you encountered: `❌ BattleManager: Battle failed: Error: workerUrl is not defined`

This was a red herring - the workerUrl IS defined, but the error was happening because of missing CORS headers on the WebSocket worker's `/notify` endpoint, which caused the WebSocket connection to fail silently during battles.

## Issues Found and Fixed

### 1. **CORS Headers Missing on `/notify` Endpoint** (Primary Issue)
**File:** `packages/svelte-multiplayer-framework/src/worker/WebSocketServer.ts`

The `/notify` endpoint that receives game update notifications from the game server was missing CORS headers. This caused cross-origin requests to fail silently in production.

**Fix:** Added CORS headers to all responses from the `handleNotification` method:
```typescript
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
```

### 2. **Added workerUrl Validation**
**File:** `packages/svelte-multiplayer-framework/src/shared/config.ts`

Added validation to give better error messages if `workerUrl` is missing:
```typescript
// Validate workerUrl for production
if (!isLocal && !config.workerUrl) {
    const error = 'workerUrl is not defined in WebSocketConfig...';
    console.error('[buildWebSocketUrl]', error, {config});
    throw new Error(error);
}
```

This helps diagnose configuration issues faster.

### 3. **Improved Error Logging**
**File:** `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts`

Enhanced error logging to better diagnose WebSocket notification failures. Now logs:
- Full request details on errors
- Worker URL being used
- Success/failure status with emojis for easy scanning
- Full error stack traces

### 4. **AI Player Field Name Bug** (Secondary Issue)
**File:** `packages/world-conflict/src/routes/api/game/[gameId]/start/+server.ts`

AI players created in the `fillRemainingSlotsWithAI` function were using `index` instead of `slotIndex`:
```typescript
// Before (WRONG):
players.push({
    id: `ai_${slot.index}`,
    index: slot.index,  // ❌ Wrong field name
    name: slot.defaultName,
    // ...
});

// After (CORRECT):
players.push({
    id: `ai_${slot.index}`,
    slotIndex: slot.index,  // ✅ Correct field name
    name: slot.defaultName,
    // ...
});
```

This could have caused issues with `getCurrentPlayer()` if AI players were added via the start endpoint.

## Deployment Instructions

### Step 1: Deploy the WebSocket Worker

```bash
cd /Users/beckerb4/Work/personal/svelte-world-conflict/packages/svelte-multiplayer-framework/src/worker
npx wrangler deploy
```

**Expected output:**
```
✨ Deployment complete!
🌍  https://svelte-world-conflict-websocket.barrybecker4.workers.dev
```

### Step 2: Deploy the World Conflict Game

```bash
cd /Users/beckerb4/Work/personal/svelte-world-conflict/packages/world-conflict
npx wrangler pages deploy dist --project-name world-conflict
```

## Testing

After deployment:

1. **Test WebSocket Worker Health:**
   ```bash
   curl https://svelte-world-conflict-websocket.barrybecker4.workers.dev/health
   ```
   Should return: `WebSocket worker is healthy`

2. **Test Game with AI:**
   - Start a new game with AI players
   - End your turn
   - Watch for AI moves in real-time (no refresh needed)
   - Check browser console for logs:
     - `✅ gameUpdate notification sent successfully` (on server)
     - `📨 [WS UPDATE] Received game update` (on client)

3. **Check Cloudflare Logs:**
   - Go to Cloudflare Dashboard → Workers & Pages
   - View logs for both services
   - Look for:
     - `📬 Notification received for game X: gameUpdate`
     - `sentCount: N` (number of clients notified)

## Why It Failed Silently Before

The WebSocket notification error was caught and logged but not thrown (by design, to not fail the game action):

```typescript
} catch (error) {
    console.error('Error notifying WebSocket worker:', error);
    // Don't throw - we don't want to fail the request if notifications fail
}
```

This meant:
- AI moves were saved to the database ✅
- But clients weren't notified in real-time ❌
- A page refresh would load the updated state from the database ✅

Now with CORS headers and better logging, you'll see either:
- `✅ notification sent successfully` - All good!
- `❌ Error notifying WebSocket worker` - Something to investigate

## Files Modified

1. `packages/svelte-multiplayer-framework/src/worker/WebSocketServer.ts`
2. `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts`
3. `packages/world-conflict/src/routes/api/game/[gameId]/start/+server.ts`
4. `packages/world-conflict/dist/` (rebuilt)

## Notes

- The build is complete and ready to deploy
- You'll need to be logged into Wrangler (`wrangler login`)
- Both services need to be deployed for the fix to work
- The WebSocket worker deployment is critical - without it, the CORS issue persists

