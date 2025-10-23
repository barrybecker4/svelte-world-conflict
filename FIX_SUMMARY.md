# AI Turn WebSocket Update Fix + Production Debugging

## Summary

You were correct! The AI players were making moves on the server, but the WebSocket notifications weren't reaching the client in production. After a page refresh, you could see the moves because they were stored in the database.

## Latest Update: Enhanced Logging + Fixed Durable Object Migration

**Deployed:** October 23, 2025

### What Was Fixed:
1. **Durable Object Migration Issue**: Changed from `new_classes` to `new_sqlite_classes` in wrangler.toml (required for free tier)
2. **Enhanced Error Handling**: Added try-catch blocks and detailed logging throughout the WebSocket worker
3. **Comprehensive Logging**: Added detailed logging at every stage of the notification pipeline

### Previous Error Found:
The WebSocket worker was throwing a 500 error when receiving notifications:
```
"❌ WebSocket worker returned error:",
{
  "status": 500,
  "statusText": "Internal Server Error",
  "body": "Worker threw exception"
}
```

This has been fixed by redeploying with the correct Durable Object configuration.

## 🎯 Testing Instructions

**Deployed URLs:**
- Game: https://fb01af34.svelte-world-conflict.pages.dev (latest deployment)
- WebSocket Worker: https://svelte-world-conflict-websocket.barrybecker4.workers.dev

**To Test:**
1. Open the game URL above
2. Start a new game with AI players
3. **Open Browser DevTools Console** before making your move
4. Make your move and click "End Turn"
5. Watch the console for log messages

**What to Look For:**

If it's working, you should see in the browser console:
```
[WS CONNECTED] Successfully connected to game WebSocket
✅ Subscribed to game {gameId}
🔚 Ending turn...
📨 [WS UPDATE] Received game update  // <-- This should appear for each AI move!
```

If AI moves still aren't showing, check **Cloudflare Logs**:
- Go to Cloudflare Dashboard → Workers & Pages
- Open "svelte-world-conflict" (Pages) → View logs
- Open "svelte-world-conflict-websocket" (Worker) → View logs
- Look for the log patterns described in the "Next Steps for Debugging" section below

**Key Metric**: Watch for `sentCount` in the logs - it should be > 0 if notifications are reaching clients.

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

## New Changes - Enhanced Logging

### 1. **Comprehensive WebSocket Notification Logging**
**File:** `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts`

Added detailed logging at every stage of the notification process:
- URL determination with environment detection
- Request preparation with body size
- Response timing and status
- Success with `sentCount` (critical metric!)
- Warning when `sentCount === 0` (no clients received the update)

Key logs to watch for:
```
📡 [WebSocketNotifier] Notifying WebSocket worker: { url, type, gameId, ... }
📤 [WebSocketNotifier] Sending fetch request: { url, bodySize, gameId }
📨 [WebSocketNotifier] Fetch response received: { status, ok, elapsed, gameId }
✅ [WebSocketNotifier] notification sent successfully: { sentCount, elapsed }
⚠️ [WebSocketNotifier] notification sent but NO CLIENTS received it  // <-- Key warning!
```

### 2. **Durable Object Session Tracking**
**File:** `packages/svelte-multiplayer-framework/src/worker/WebSocketServer.ts`

Enhanced logging in the Durable Object to track:
- WebSocket connection establishment
- Game subscription registration  
- Session counts per game
- Notification delivery attempts

**File:** `packages/svelte-multiplayer-framework/src/worker/SessionManager.ts`

Added helper methods:
- `getAllSessionCount()` - Total active WebSocket connections
- `getAllSessionsDebug()` - Detailed session information

Key logs to watch for:
```
📝 [DO] Session {id} subscribing to game {gameId}: { totalSessionsBefore, existingGameSessions }
✅ [DO] Session {id} successfully subscribed: { totalSessions, gameSessionsNow, allGameSessions }
📬 [DO] Notification received for game {gameId}: { messageType, totalSessions, gameSessionsCount }
⚠️ [DO] No sessions received notification for game {gameId}  // <-- Key warning!
```

## Potential Root Causes

Based on the enhanced logging, the issue could be one of these:

### Theory 1: Durable Object Routing Issue
- WebSocket connections might go to a different DO instance than notifications
- This would show: `sentCount: 0` with `gameSessionsCount: 0` in DO logs
- But client logs show successful subscription

### Theory 2: Session State Loss
- Durable Object might be hibernating or resetting between subscription and notification
- This would show: Session exists during subscribe, but gone during notification
- Common in Cloudflare DO if not using persistence properly

### Theory 3: Environment Variable Issue  
- `process.env.NODE_ENV` might not be set correctly in Cloudflare Pages Functions
- Could cause wrong worker URL to be used (though logs should show this)

### Theory 4: Timing Issue with AI Processing
- WebSocket connections might close/timeout during AI turn processing
- The 100ms delay between AI moves might cause connection drops
- Would show: Sessions start > 0 but decrease to 0 during processing

## Files Modified

1. `packages/svelte-multiplayer-framework/src/worker/WebSocketServer.ts` - Enhanced notification and subscription logging
2. `packages/svelte-multiplayer-framework/src/worker/SessionManager.ts` - Added session tracking methods  
3. `packages/world-conflict/src/lib/server/websocket/WebSocketNotifier.ts` - Comprehensive logging throughout
4. Both packages rebuilt (`dist/` updated)

## Next Steps for Debugging

After deployment, follow this process:

1. **Deploy both services** (see Deployment Instructions above)

2. **Open browser console AND Cloudflare dashboard logs side-by-side**
   - Browser: Check for WebSocket connection and subscription messages
   - Cloudflare: Workers & Pages → Select your services → View logs (real-time tail)

3. **Start a game with AI and make your move**

4. **When you click "End Turn", watch for these log patterns:**

   **In Browser Console:**
   ```
   [WS CONNECTED] Successfully connected to game WebSocket
   ✅ Subscribed to game {gameId}
   🔚 Ending turn...
   ```

   **In Cloudflare Pages Logs (game server):**
   ```
   🔧 [WebSocketNotifier] Worker URL determined: { isDev, url, nodeEnv }
   📡 [WebSocketNotifier] Notifying WebSocket worker: { url, type, gameId }
   📤 [WebSocketNotifier] Sending fetch request: { url, bodySize }
   📨 [WebSocketNotifier] Fetch response received: { status, ok, elapsed }
   ✅ [WebSocketNotifier] notification sent: { sentCount, elapsed }
   ```

   **In Cloudflare Worker Logs (WebSocket worker):**
   ```
   📝 [DO] Session {id} subscribing to game {gameId}: { totalSessionsBefore, existingGameSessions }
   ✅ [DO] Session {id} successfully subscribed: { gameSessionsNow, allGameSessions }
   📬 [DO] Notification received for game {gameId}: { totalSessions, gameSessionsCount }
   Broadcasting to {N} sessions for game {gameId}
   ```

5. **Key metrics to check:**
   - `sentCount` in WebSocketNotifier logs - should be > 0
   - `gameSessionsCount` in DO logs - should match number of connected players
   - `totalSessions` - should show all active WebSocket connections

6. **If `sentCount: 0`:**
   - Check DO logs for session subscription
   - Verify gameId matches between subscription and notification
   - Check if sessions are being lost between subscribe and notify

7. **Report findings:**
   Share the relevant log excerpts showing:
   - Browser subscription confirmation
   - WebSocketNotifier sending notification
   - Durable Object receiving notification
   - What the `sentCount` and `gameSessionsCount` values are

## Notes

- The build is complete and ready to deploy
- You'll need to be logged into Wrangler (`wrangler login`)
- Both services need to be deployed for the fix to work
- The enhanced logging will help us pinpoint exactly where the notification pipeline breaks in production

