# E2E Tests Quick Start Guide

## First Time Setup

1. Install Playwright browsers:
```bash
cd packages/world-conflict
npx playwright install
```

## Running Tests

### Run all tests (recommended to start)
```bash
npm run test:e2e
```

### Run tests with visual feedback (watch the browser)
```bash
npx playwright test --headed
```

### Run tests in debug mode (step through each action)
```bash
npx playwright test --debug
```

### Run a specific test
```bash
npx playwright test tests/e2e/single-human-ai.spec.ts
```

### Run only one test case
```bash
npx playwright test -g "Test 1: Human in slot 1"
```

## What to Expect

When tests run successfully, you should see:
```
Running 3 tests using 1 worker

  ✓  single-human-ai.spec.ts:20:3 › Test 1: Human in slot 1, AI in slot 2
  ✓  single-human-ai.spec.ts:90:3 › Test 2: Human in slot 1, AI in slot 3
  ✓  single-human-ai.spec.ts:138:3 › Test 3: AI in slot 1, Human in slot 4

  3 passed (45s)
```

## Debugging Failed Tests

If a test fails:

1. **Check the screenshot**: Failed tests automatically capture screenshots in `test-results/`

2. **View the HTML report**:
```bash
npx playwright show-report
```

3. **Run with trace** (detailed recording):
```bash
npx playwright test --trace on
```

4. **Run in slow motion** (easier to see what's happening):
```bash
npx playwright test --headed --slow-mo=1000
```

## Common Issues

### Issue: "Dev server not responding"
**Solution**: Make sure no other dev server is running on port 5173

### Issue: "Test timeout on instructions"
**Solution**: The tutorial modal has 5 cards that need to be clicked through. The helper automatically does this. If you want faster tests, use `skipInstructionsQuick()` instead of `skipInstructions()` in your test files.

### Issue: "Test timeout"
**Solution**: AI turns can be slow. Increase timeout in `fixtures/test-data.ts`:
```typescript
export const TIMEOUTS = {
  AI_TURN: 60000, // Increase from 30s to 60s
};
```

### Issue: "Element not found"
**Solution**: Component may not have loaded yet. Check that all test IDs match the actual component IDs.

### Issue: "Expected 'Player 1' but got 'Emerald'"
**Solution**: AI players use default names (Emerald, Crimson, Amber, Lavender) from `playerConfigs.ts`. Use `AI_PLAYER_NAMES` from test fixtures instead of generic player names.

### Issue: "Modal overlay intercepts pointer events"
**Solution**: Game modals (like soldier selection) can block buttons. The `endTurn()` helper automatically dismisses modals. If you're writing custom interactions, call `dismissAnyModals()` first.

### Issue: "AI turn never completes / timeout"
**Solution**: With only 2 players, the game might end quickly if one player dominates. The test handles this by checking for game over conditions. Increase AI_TURN timeout if needed.

## Test Configuration

Tests are configured in `playwright.config.ts`:
- Dev server runs automatically on port 5173
- Tests use Chromium by default
- Screenshots captured on failure
- Traces captured on first retry

## Next Steps

After running the initial tests successfully:

1. Review the test output and screenshots
2. Identify any bugs in multiplayer gameplay
3. Add new test cases for multi-human scenarios (Test 4-6)
4. Extend helper functions for more complex interactions

## Need Help?

See full documentation in `tests/e2e/README.md`
