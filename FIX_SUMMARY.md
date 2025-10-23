# AI Turn WebSocket Update Fix + workerUrl Error Fix

## Summary

You were correct! The AI players were making moves on the server, but the WebSocket notifications weren't reaching the client in production. After a page refresh, you could see the moves because they were stored in the database.

## Update: New Error Found

After your first deployment, you encountered: `❌ BattleManager: Battle failed: Error: workerUrl is not defined`

### Root Cause Discovered!

This error was actually a **JavaScript reference error in the error-handling code itself**! 

In `WebSocketNotifier.ts`, the `catch` block was trying to log `workerUrl`, but that variable was only defined inside the `try` block. When any error occurred in the WebSocket notification code, JavaScript would throw `ReferenceError: workerUrl is not defined` while trying to log the error, completely masking the **actual** error.

This is a classic bug where poor error handling makes debugging nearly impossible.

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

### 3. **Fixed Variable Scoping Bug in Error Handler** (Critical!)
**File:** `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts`

**Problem:** The error `"workerUrl is not defined"` was actually a JavaScript `ReferenceError`! The `catch` block was trying to log `workerUrl`, but it was only defined inside the `try` block.

**Fix:** Moved `workerUrl` declaration outside the try-catch:
```typescript
private async send(gameId: string, type: string, gameState: any): Promise<void> {
    let workerUrl: string | undefined;  // Now accessible in catch block
    try {
        workerUrl = this.getWorkerUrl();
        // ... rest of code
    } catch (error) {
        console.error('❌ Error notifying WebSocket worker:', {
            workerUrl: workerUrl || 'undefined',  // Safe to reference now
            // ... other error details
        });
    }
}
```

This was masking the **real** error that was occurring!

### 4. **Added Better Logging and Validation**
**Files:** 
- `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts`
- `packages/world-conflict/src/lib/websocket-config.ts`

Added detailed logging to `getWorkerHttpUrl()` to see exactly what URL is being used:
```typescript
export function getWorkerHttpUrl(isLocal: boolean = false): string {
    const url = isLocal ? 'http://localhost:8787' : WEBSOCKET_WORKER_URL;
    console.log('[getWorkerHttpUrl]', { isLocal, url, constantValue: WEBSOCKET_WORKER_URL });
    
    if (!url || url === 'undefined') {
        throw new Error(`WebSocket worker URL is not defined!`);
    }
    
    return url;
}
```

Enhanced error logging throughout to better diagnose WebSocket notification failures.

### 5. **AI Player Field Name Bug** (Secondary Issue)
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

