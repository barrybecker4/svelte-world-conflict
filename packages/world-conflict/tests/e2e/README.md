# E2E Tests for World Conflict

This directory contains end-to-end tests using Playwright to verify multiplayer gameplay functionality.

## Purpose

These tests help debug and verify the multiplayer game flow, particularly:
- Turn order with different player configurations
- AI player behavior
- Human + AI player interactions
- Multi-human player scenarios

## Setup

1. Make sure dependencies are installed:
```bash
npm install
```

2. Install Playwright browsers (if not already installed):
```bash
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests in headed mode (see the browser)
```bash
npx playwright test --headed
```

### Run a specific test file
```bash
npx playwright test tests/e2e/single-human-ai.spec.ts
npx playwright test tests/e2e/multi-human-players.spec.ts
npx playwright test tests/e2e/multi-human-gameplay.spec.ts
npx playwright test tests/e2e/multi-human-edge-cases.spec.ts
```

### Run a specific test by name
```bash
npx playwright test -g "Test 4: Four Human Players"
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests with UI mode (recommended for debugging)
```bash
npx playwright test --ui
```

### Run tests against deployed production environment

By default, tests run against a local dev server. To test against the deployed production app:

```bash
# Use the production config
npx playwright test --config=playwright.config.production.ts

# Or specify a custom URL
BASE_URL=https://your-custom-url.pages.dev npx playwright test --config=playwright.config.production.ts
```

**Important Notes:**
- The production config (`playwright.config.production.ts`) uses `https://svelte-world-conflict.pages.dev` by default
- Tests will interact with the live production environment and create real game data in KV storage
- Make sure both the game app AND the WebSocket worker are deployed before running tests
- WebSocket worker URL: `https://multiplayer-games-websocket.barrybecker4.workers.dev`
- Consider using a preview/staging environment for testing instead of production

**Running specific tests against production:**
```bash
# Run a single test file
npx playwright test tests/e2e/single-human-ai.spec.ts --config=playwright.config.production.ts

# Run tests in headed mode to watch
npx playwright test --config=playwright.config.production.ts --headed

# Run with UI mode for debugging
npx playwright test --config=playwright.config.production.ts --ui
```

**Convenient npm scripts:**
```bash
# Run all e2e tests against production
npm run test:e2e:prod

# Run in headed mode
npm run test:e2e:prod:headed

# Run in UI mode
npm run test:e2e:prod:ui
```

## Test Structure

### Fixtures (`fixtures/`)
- `test-data.ts` - Constants and test data used across tests
  - `TEST_PLAYERS` - Human player names for tests
  - `AI_PLAYER_NAMES` - Default AI player names (Emerald, Crimson, Amber, Lavender)
  - `GAME_SETTINGS` - Preset game configurations
  - `TIMEOUTS` - Timeout values for various operations

### Helpers (`helpers/`)
- `game-setup.ts` - Helper functions for game setup (name entry, configuration, etc.)
  - `skipInstructions()` - Clicks through all tutorial cards (5 cards) then "Got it!"
  - `skipInstructionsQuick()` - Clicks the X close button for faster tests
  - `enterPlayerName()`, `configurePlayerSlot()`, etc.
- `game-actions.ts` - Helper functions for in-game actions (moves, attacks, turn management)

### Test Files
- `single-human-ai.spec.ts` - Tests for single human + AI player scenarios (3 tests)
- `multi-human-players.spec.ts` - Core multi-player tests (Tests 1-9)
- `multi-human-gameplay.spec.ts` - Gameplay integration tests (Tests 10-11)
- `multi-human-edge-cases.spec.ts` - Advanced edge case tests (Tests 12-13)

## Current Test Coverage

### Single Player + AI Tests

#### Test 1: Human in slot 1, AI in slot 2
- Human player goes first
- AI player goes second
- Verifies turn order over multiple turns

#### Test 2: Human in slot 1, AI in slot 3 (slot 2 off)
- Human player goes first
- AI player in slot 3 goes second (skipping inactive slot 2)
- Verifies turn order correctly skips inactive slots

#### Test 3: AI in slot 1, Human in slot 4 (slots 2-3 off)
- AI player goes first
- Human player in slot 4 goes second
- Verifies AI can take first turn and human plays correctly after

### Multi-Player Tests

**Status**: ✅ Comprehensive test suite implemented with 13 tests covering 2-4 players, edge cases, and gameplay integration.

#### Core Multi-Player Tests (`multi-human-players.spec.ts`)

**Test 1: Two Human Players - Adjacent Slots**
- Two players in slots 0-1
- Verifies waiting room synchronization
- Tests turn transitions with WebSocket updates
- Validates turn counter sync across both players

**Test 2: Two Human Players - Start Anyway with AI**
- Creator in last slot, one joiner
- Tests "start anyway" functionality
- Remaining open slots fill with AI
- Verifies mixed human/AI turn order

**Test 3: Three Human Players - With Inactive Slot**
- Three players with slot 1 inactive
- Tests 3-way synchronization
- Verifies inactive slots skipped in turn order

**Test 4: Four Human Players - Full Game**
- All 4 slots filled with human players
- Tests 4-way synchronization
- Verifies complete turn cycles with all players
- Validates auto-start when all slots filled

**Test 5: Mixed Human/AI with Creator in Middle**
- Creator in slot 2, player in slot 0, AI in slot 3, slot 1 off
- Tests non-sequential player positions
- Verifies turn order with mixed configuration
- Tests AI turn integration

**Test 6: Late Joiner - Game Already Started**
- Player attempts to join after game starts
- Verifies late joiner is rejected or redirected
- Original game continues unaffected
- Edge case: joining active games

**Test 7: Player Leaves Waiting Room**
- Player disconnects from waiting room
- Slot becomes available again
- Another player can join freed slot
- Game starts normally with replacement player

**Test 8: Rapid Join Scenario - Race Condition**
- Two players join simultaneously
- Tests concurrent join API calls
- Verifies no slot collision
- Both players assigned different slots

**Test 9: Start Anyway with Minimal Players**
- Creator starts game solo (no other humans)
- 3 AI fill remaining slots
- Tests 1 human + 3 AI gameplay
- Verifies game progression with mostly AI

#### Gameplay Integration Tests (`multi-human-gameplay.spec.ts`)

**Test 10: Four Players - Territory Interactions**
- 4 players in full game
- Territory claiming and interactions
- Map interaction testing
- Verifies state synchronization during gameplay

**Test 11: Connection Recovery - Page Reload**
- 2-player game in progress
- Player reloads page mid-game
- Tests reconnection and state recovery
- Gameplay continues normally after reload

#### Advanced Edge Cases (`multi-human-edge-cases.spec.ts`)

**Test 12: Multiple Games Simultaneously**
- 2 separate games running at once
- Game A: Players 1 & 2
- Game B: Players 3 & 4
- Verifies no state leakage between games

**Test 13: Maximum Turn Limit**
- Game with maxTurns: 3
- Plays through all turns
- Verifies game ends at turn limit
- Tests end-game state detection

See `MULTI_PLAYER_TEST_PLAN.md` for complete test specifications.

## How Tests Work

1. **Navigation**: Tests start at the home page and navigate through the UI
2. **Configuration**: Tests configure player slots, game settings, and create games
3. **Game Flow**: Tests verify turn order, player actions, and game state
4. **Assertions**: Tests use Playwright's `expect` to verify expected behavior

## Test IDs

Components have been annotated with `data-testid` attributes for reliable element selection:

### Setup/Configuration
- `instructions-modal` - Instructions modal container
- `instructions-proceed-btn` - Button to proceed past instructions
- `player-name-input` - Player name input field
- `player-name-submit` - Submit button for player name
- `new-game-btn` - New game button in lobby
- `player-slot-{index}-type` - Slot configuration dropdown
- `game-setting-mapsize` - Map size setting
- `game-setting-aidifficulty` - AI difficulty setting
- `game-setting-maxturns` - Max turns setting
- `game-setting-timelimit` - Time limit setting
- `create-game-btn` - Create game button

### Waiting Room
- `waiting-room` - Waiting room container
- `start-game-btn` - Start game button
- `leave-game-btn` - Leave game button

### Game Interface
- `game-interface` - Main game container
- `game-map` - Game map container
- `turn-number` - Current turn number display
- `current-turn-player` - Name of player whose turn it is
- `current-phase` - Current game phase/instructions
- `player-info-{name}` - Player info panel
- `player-territories` - Territory count
- `player-units` - Unit/faith count
- `end-turn-btn` - End turn button

## Adding New Tests

1. Create a new test file in `tests/e2e/` with `.spec.ts` extension
2. Import helper functions from `helpers/`
3. Use `test.describe()` to group related tests
4. Use `test()` for individual test cases
5. Follow the pattern: Setup → Action → Verify

Example:
```typescript
import { test, expect } from '@playwright/test';
import { skipInstructions, enterPlayerName } from './helpers/game-setup';

test.describe('My Test Suite', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await skipInstructions(page);
    // ... rest of test
  });
});
```

## Debugging Tips

### Visual Debugging
Use headed mode to watch tests execute:
```bash
npx playwright test --headed --slow-mo=1000
```

### Inspector
Use the Playwright inspector to step through tests:
```bash
npx playwright test --debug
```

### Screenshots
Tests automatically capture screenshots on failure. Find them in `test-results/`.

### Trace Viewer
View detailed traces of failed tests:
```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Console Logs
Tests include console.log statements for debugging. View them with:
```bash
npx playwright test --reporter=list
```

## Known Issues / Limitations

1. **Timing**: AI turns may take variable time depending on game complexity. Tests have adequate timeouts.
2. **Randomness**: Game map generation is random, which can affect test stability
3. **WebSocket**: Tests rely on WebSocket connections for real-time updates. Some tests simulate disconnects/reconnects.
4. **Instructions Modal**: The tutorial has 5 cards - `skipInstructions()` clicks through all of them. Use `skipInstructionsQuick()` for faster test runs.
5. **AI Player Names**: AI players use default names from `playerConfigs.ts` (Emerald, Crimson, Amber, Lavender), not generic names like "Player 1". Use `AI_PLAYER_NAMES` from test fixtures.
6. **Game Modals**: Modals (like soldier selection) can block UI interactions. The `endTurn()` helper automatically dismisses modals before clicking.
7. **Early Game Endings**: With only 2 players, games can end quickly if one player dominates. Tests handle this gracefully.
8. **Map Size**: Use 'Medium' or larger maps for multi-player tests to ensure enough temple regions for all players.
9. **Multi-Browser Tests**: Multi-player tests use multiple browser contexts simultaneously, which requires more system resources.

## Multi-Player Test Documentation

For comprehensive multi-player test information, see:
- **MULTI_PLAYER_TEST_PLAN.md** - Full test specifications and architecture
- **MULTI_PLAYER_QUICK_REFERENCE.md** - Quick lookup for common patterns
- **TEST_SCENARIOS_VISUAL.md** - Visual diagrams of all test scenarios
- **IMPLEMENTATION_ROADMAP.md** - Step-by-step implementation guide
- **IMPLEMENTATION_STATUS.md** - Current status and known issues

### Multi-Player Helper Functions

New helper functions for multi-player tests (in `helpers/game-setup.ts`):
- `joinExistingGame(page, gameId, playerName)` - Join a game via API
- `waitForPlayerToJoin(page, playerName, slotIndex)` - Wait for WebSocket update
- `startGameAnywayFromWaitingRoom(page)` - Start with unfilled slots
- `waitForAllGamesToLoad(pages[])` - Sync multiple player loads

New helper functions for multi-player coordination (in `helpers/game-actions.ts`):
- `synchronizeTurnTransition(pages[], fromPlayer, toPlayer)` - Sync turn changes
- `verifyTurnOrder(pages[], expectedPlayer)` - Validate turn order
- `verifyTurnNumberSync(pages[])` - Check turn counter sync
- `executeMultiPlayerTurnCycle(playersData[])` - Automate turn cycles

## Timeouts

Default timeouts are configured in `playwright.config.ts` and `fixtures/test-data.ts`:
- Element load: 5 seconds
- AI turn: 30 seconds
- Game load: 10 seconds
- Turn transition: 5 seconds
- WebSocket update: 3 seconds

Test-specific timeouts:
- Single-player tests: 90 seconds
- Multi-player core tests: 180 seconds (3 minutes)
- Gameplay integration: 240 seconds (4 minutes)
- Advanced edge cases: 300 seconds (5 minutes)

Adjust in `fixtures/test-data.ts` if needed.

## CI/CD Integration

Tests are configured to run in CI environments:
- Retries: 2 times on failure (CI only)
- Workers: 1 (CI) / unlimited (local)
- Screenshots: Captured on failure
- Traces: Captured on first retry

## Contributing

When adding new tests:
1. Use existing helper functions when possible
2. Add new test IDs to components as needed
3. Update this README with new test coverage
4. Ensure tests are deterministic and reliable
5. Add appropriate timeouts for async operations
