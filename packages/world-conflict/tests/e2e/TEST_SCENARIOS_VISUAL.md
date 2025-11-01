# Multi-Player Test Scenarios - Visual Guide

## Legend
```
🟢 = Human Player (Set)
🔵 = Human Player (Open - to be filled)
🤖 = AI Player
⚫ = Inactive Slot (Off)
👑 = Game Creator
```

---

## Test 1: Two Humans - Adjacent Slots
**Goal**: Verify basic 2-player flow, waiting room, and turn order

```
Before Start:
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 👑🟢 Player1   │
│ Slot 1 (Crimson)  : 🔵 → 🟢 Player2│
│ Slot 2 (Amber)    : ⚫ Off          │
│ Slot 3 (Lavender) : ⚫ Off          │
└─────────────────────────────────────┘

Turn Order:
Player1 → Player2 → Player1 → Player2 → ...
   ↓         ↓         ↓         ↓
 Turn 1    Turn 1    Turn 2    Turn 2
```

**Key Verifications:**
- ✅ Both players see each other in waiting room
- ✅ Start button enables when both players joined
- ✅ Turn order cycles correctly
- ✅ Turn counter syncs across both players

---

## Test 2: Two Humans - Creator in Last Slot
**Goal**: Verify "start anyway" with remaining slots becoming AI

```
Before Start:
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 🔵 → 🟢 Player2│
│ Slot 1 (Crimson)  : 🔵 (empty)     │
│ Slot 2 (Amber)    : 🔵 (empty)     │
│ Slot 3 (Lavender) : 👑🟢 Player1   │
└─────────────────────────────────────┘

After "Start Anyway":
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 🟢 Player2     │
│ Slot 1 (Crimson)  : 🤖 AI          │
│ Slot 2 (Amber)    : 🤖 AI          │
│ Slot 3 (Lavender) : 👑🟢 Player1   │
└─────────────────────────────────────┘

Turn Order:
Player2 → AI(Crimson) → AI(Amber) → Player1 → ...
```

**Key Verifications:**
- ✅ "Start anyway" button visible to creator
- ✅ Open slots convert to AI
- ✅ Turn order includes AI players
- ✅ AI takes turns automatically

---

## Test 3: Three Humans - With Gap
**Goal**: Verify 3-player coordination and inactive slot handling

```
Configuration:
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 👑🟢 Player1   │
│ Slot 1 (Crimson)  : ⚫ Off          │
│ Slot 2 (Amber)    : 🔵 → 🟢 Player2│
│ Slot 3 (Lavender) : 🔵 → 🟢 Player3│
└─────────────────────────────────────┘

Turn Order (Slot 1 skipped):
Player1 → Player2 → Player3 → Player1 → ...
 (s0)      (s2)      (s3)      (s0)
```

**Key Verifications:**
- ✅ Inactive slots are skipped in turn order
- ✅ All 3 players see synchronized state
- ✅ Turn transitions work with 3 WebSocket connections
- ✅ No race conditions in 3-way coordination

---

## Test 4: Four Humans - Full Game
**Goal**: Verify maximum player capacity

```
Configuration:
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 👑🟢 Player1   │
│ Slot 1 (Crimson)  : 🔵 → 🟢 Player2│
│ Slot 2 (Amber)    : 🔵 → 🟢 Player3│
│ Slot 3 (Lavender) : 🔵 → 🟢 Player4│
└─────────────────────────────────────┘

Turn Order:
Player1 → Player2 → Player3 → Player4 → Player1 → ...
   ↓         ↓         ↓         ↓         ↓
 Turn 1    Turn 1    Turn 1    Turn 1    Turn 2
```

**Key Verifications:**
- ✅ All 4 players can join
- ✅ Start button auto-enables when all slots filled
- ✅ Complete turn cycle with 4 players
- ✅ All players stay synchronized

---

## Test 5: Mixed Configuration
**Goal**: Verify complex slot setup with human/AI/off mix

```
Configuration:
┌─────────────────────────────────────┐
│ Slot 0 (Emerald)  : 🔵 → 🟢 Player2│
│ Slot 1 (Crimson)  : ⚫ Off          │
│ Slot 2 (Amber)    : 👑🟢 Player1   │
│ Slot 3 (Lavender) : 🤖 AI (preset) │
└─────────────────────────────────────┘

Turn Order (Slot 1 skipped):
Player2 → Player1 → AI(Lavender) → Player2 → ...
 (s0)      (s2)         (s3)        (s0)
```

**Key Verifications:**
- ✅ Pre-configured AI slots work
- ✅ Creator can be in middle position
- ✅ Mixed config turn order correct
- ✅ AI integrates with human players

---

## Test 6: Late Joiner (Edge Case)
**Goal**: Verify game start prevents late joining

```
Timeline:

T0: Player1 creates game
┌─────────────────────────────────────┐
│ Slot 0 : 👑🟢 Player1               │
│ Slot 1 : 🔵 Open                    │
│ Slot 2 : ⚫ Off                     │
│ Slot 3 : ⚫ Off                     │
└─────────────────────────────────────┘

T1: Player1 waits...
    Player2 navigates slowly...

T2: Player1 clicks "Start Anyway"
┌─────────────────────────────────────┐
│ Slot 0 : 👑🟢 Player1               │
│ Slot 1 : 🤖 AI (filled)             │
│ Slot 2 : ⚫ Off                     │
│ Slot 3 : ⚫ Off                     │
└─────────────────────────────────────┘
Game Status: ACTIVE ✅

T3: Player2 tries to join
    ❌ Blocked - Game already started
    → Redirected to lobby
```

**Key Verifications:**
- ✅ Game state changes from "waiting" to "active"
- ✅ Late joiner gets error/redirect
- ✅ Started game not disrupted

---

## Test 7: Player Leaves Waiting Room
**Goal**: Verify leave/rejoin functionality

```
Phase 1: All join
┌─────────────────────────────────────┐
│ Slot 0 : 👑🟢 Player1               │
│ Slot 1 : 🟢 Player2                 │
│ Slot 2 : 🟢 Player3                 │
│ Slot 3 : ⚫ Off                     │
└─────────────────────────────────────┘

Phase 2: Player2 leaves
┌─────────────────────────────────────┐
│ Slot 0 : 👑🟢 Player1               │
│ Slot 1 : 🔵 Open (freed)            │
│ Slot 2 : 🟢 Player3                 │
│ Slot 3 : ⚫ Off                     │
└─────────────────────────────────────┘

Phase 3: Player4 joins freed slot
┌─────────────────────────────────────┐
│ Slot 0 : 👑🟢 Player1               │
│ Slot 1 : 🟢 Player4                 │
│ Slot 2 : 🟢 Player3                 │
│ Slot 3 : ⚫ Off                     │
└─────────────────────────────────────┘
```

**Key Verifications:**
- ✅ Leave button works
- ✅ Leaving player returns to lobby
- ✅ Slot becomes open again
- ✅ Other players see update
- ✅ New player can fill slot
- ✅ Game starts successfully

---

## Test 8: Territory Control Gameplay
**Goal**: Verify synchronized gameplay state

```
Setup: 2 Players

Turn 1 - Player1 claims territories:
┌────────────────┐
│ Map State:     │
│ ┌──┬──┬──┐    │
│ │🟢│  │🔴│    │ 🟢 = Player1
│ ├──┼──┼──┤    │ 🔴 = Player2
│ │🟢│  │🔴│    │ ⬜ = Neutral
│ ├──┼──┼──┤    │
│ │🟢│  │🔴│    │
│ └──┴──┴──┘    │
└────────────────┘

Turn 2 - Player1 attacks Player2:
┌────────────────┐
│ Battle Result: │
│ 🟢 ⚔️ 🔴       │
│ Player1 wins!  │
│                │
│ ┌──┬──┬──┐    │
│ │🟢│  │🟢│ ← Changed│
│ ├──┼──┼──┤    │
│ │🟢│  │🔴│    │
│ ├──┼──┼──┤    │
│ │🟢│  │🔴│    │
│ └──┴──┴──┘    │
└────────────────┘
```

**Key Verifications:**
- ✅ Both players see same map
- ✅ Battle results sync in real-time
- ✅ Territory counters update correctly
- ✅ No state divergence

---

## Test Flow Patterns

### Pattern A: Create and Join
```
Player1                    Player2
   │                          │
   ├─ goto('/')              │
   ├─ skipInstructions()     │
   ├─ createGame()           │
   ├─ waitInRoom()           │
   │                          ├─ goto('/')
   │                          ├─ skipInstructions()
   │                          ├─ joinGame(gameId)
   │◄─────WebSocket update────│
   ├─ seePlayer2Joined()     ├─ inWaitingRoom()
   ├─ startGame() ─────────►│
   │                          │
```

### Pattern B: Turn Coordination
```
Player1                    Player2
   │                          │
   ├─ myTurn: true           ├─ myTurn: false
   ├─ takeActions()          │
   ├─ endTurn() ─────────►  │
   │                          │
   │◄─────WebSocket update────│
   ├─ myTurn: false          ├─ myTurn: true
   │                          ├─ takeActions()
   │                          ├─ endTurn()
   │◄─────WebSocket update────│
   ├─ myTurn: true           ├─ myTurn: false
   │                          │
```

### Pattern C: Cleanup
```
Player1                    Player2
   │                          │
   │ (test completes)         │ (test completes)
   │                          │
   ├─ context1.close()       ├─ context2.close()
   │                          │
   ✓ Cleanup                 ✓ Cleanup
```

---

## Synchronization Points

### Critical Sync Points in Tests:

1. **After Player Joins**
   ```
   await waitForPlayerToJoin(creator, joiner, slotIndex);
   await page.waitForTimeout(WEBSOCKET_UPDATE_TIME);
   ```

2. **Before Starting Game**
   ```
   await expect(startButton).toBeEnabled();
   // All players should see enabled button
   ```

3. **After Game Starts**
   ```
   await Promise.all([
     waitForGameLoad(player1),
     waitForGameLoad(player2),
     waitForGameLoad(player3),
   ]);
   ```

4. **Turn Transitions**
   ```
   await synchronizeTurnTransition(
     [player1, player2],
     fromPlayer,
     toPlayer
   );
   ```

---

## Common Issues and Solutions

### Issue 1: WebSocket Timing
```
❌ Problem:
   Player1 starts game before Player2's join propagates
   
✅ Solution:
   await waitForPlayerToJoin(player1, PLAYER2, 1);
   await page.waitForTimeout(WEBSOCKET_UPDATE);
```

### Issue 2: Race Conditions
```
❌ Problem:
   Multiple players try to end turn simultaneously
   
✅ Solution:
   Verify turn ownership before allowing actions
   await expect(endTurnBtn).toBeEnabled()
```

### Issue 3: Context Leaks
```
❌ Problem:
   Browser contexts not closed, memory leak
   
✅ Solution:
   Always use try/finally:
   try {
     // test code
   } finally {
     await context1.close();
     await context2.close();
   }
```

### Issue 4: State Desync
```
❌ Problem:
   Players see different game state
   
✅ Solution:
   Verify state on both clients:
   const turn1 = await getCurrentTurn(player1);
   const turn2 = await getCurrentTurn(player2);
   expect(turn1).toBe(turn2);
```

---

## Test Execution Matrix

| Test # | Players | Browsers | AI | Duration | Priority |
|--------|---------|----------|----|---------:|----------|
| 1      | 2       | 2        | 0  | ~30s     | P0 🔴    |
| 2      | 2       | 2        | 2  | ~40s     | P0 🔴    |
| 3      | 3       | 3        | 0  | ~45s     | P1 🟡    |
| 4      | 4       | 4        | 0  | ~60s     | P1 🟡    |
| 5      | 2       | 2        | 1  | ~40s     | P1 🟡    |
| 6      | 2       | 2        | 0  | ~25s     | P2 🟢    |
| 7      | 3→4     | 4        | 0  | ~50s     | P2 🟢    |
| 8      | 2       | 2        | 0  | ~60s     | P1 🟡    |
| 9      | 2       | 2        | 0  | ~45s     | P2 🟢    |
| 10-12  | 2       | 2        | 0  | ~30s ea  | P3 ⚪    |

**Total Estimated Runtime**: ~8-10 minutes

---

## Resource Requirements

### Per Test:
- Browsers: 2-4 simultaneous Chrome instances
- Memory: ~200-400MB per browser context
- Network: WebSocket connections per player

### Recommendations:
- Run tests sequentially (workers: 1)
- Close contexts immediately after each test
- Use `skipInstructionsQuick()` for speed
- Set shorter game durations (QUICK settings)

---

**Last Updated**: October 25, 2025
**For Full Details**: See `MULTI_PLAYER_TEST_PLAN.md`

