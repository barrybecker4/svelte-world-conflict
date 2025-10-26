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
```

### Run tests in debug mode
```bash
npx playwright test --debug
```

### Run tests with UI mode (recommended for debugging)
```bash
npx playwright test --ui
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
- `single-human-ai.spec.ts` - Tests for single human + AI player scenarios
- `multi-human-players.spec.ts` - Tests for multiple human player scenarios (see below)

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

### Multi-Player Tests (In Progress)

**Status**: ⚠️ Infrastructure complete, blocked by backend storage issue. See `IMPLEMENTATION_STATUS.md` for details.

#### Test 1: Two Human Players - Adjacent Slots
- Two players in slots 0-1
- Verifies waiting room synchronization
- Tests turn transitions with WebSocket updates
- Validates turn counter sync across both players

#### Test 2: Two Human Players - Start Anyway with AI
- Creator in last slot, one joiner
- Tests "start anyway" functionality
- Remaining open slots fill with AI
- Verifies mixed human/AI turn order

#### Test 3: Three Human Players - With Inactive Slot
- Three players with slot 1 inactive
- Tests 3-way synchronization
- Verifies inactive slots skipped in turn order

**Coming Soon**: Tests 4-12 covering 4 players, edge cases, and gameplay scenarios.

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

1. **Timing**: AI turns may take variable time depending on game complexity. Tests have 60s timeout.
2. **Randomness**: Game map generation is random, which can affect test stability
3. **WebSocket**: Tests rely on WebSocket connections for real-time updates
4. **Instructions Modal**: The tutorial has 5 cards - `skipInstructions()` clicks through all of them. Use `skipInstructionsQuick()` for faster test runs.
5. **AI Player Names**: AI players use default names from `playerConfigs.ts` (Emerald, Crimson, Amber, Lavender), not generic names like "Player 1". Use `AI_PLAYER_NAMES` from test fixtures.
6. **Game Modals**: Modals (like soldier selection) can block UI interactions. The `endTurn()` helper automatically dismisses modals before clicking.
7. **Early Game Endings**: With only 2 players, games can end quickly if one player dominates. Test 3 handles this gracefully.
8. **Multi-Player Storage**: Multi-player tests currently blocked by KV storage setup issue. See `IMPLEMENTATION_STATUS.md` for details and workarounds.

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

Default timeouts are configured in `playwright.config.ts`:
- Element load: 5 seconds
- AI turn: 30 seconds
- Game load: 10 seconds

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

