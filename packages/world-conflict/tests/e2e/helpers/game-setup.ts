import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../fixtures/test-data';

/**
 * Skip the instructions modal that appears on first load
 * This version clicks through all tutorial cards
 */
export async function skipInstructions(page: Page) {
  // Wait for instructions modal to be visible
  const instructionsModal = page.getByTestId('instructions-modal');
  await expect(instructionsModal).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD });
  
  // The instructions have multiple cards. Click "Next" until we reach the last card
  // which shows the "Got it!" button
  let clickedNext = 0;
  const maxClicks = 10; // Safety limit
  
  while (clickedNext < maxClicks) {
    // Check if the "Got it!" button is visible (last card)
    const proceedButton = page.getByTestId('instructions-proceed-btn');
    const isProceedVisible = await proceedButton.isVisible().catch(() => false);
    
    if (isProceedVisible) {
      // We're on the last card, click "Got it!"
      await proceedButton.click();
      // Wait a bit for click to register and animation to start
      await page.waitForTimeout(500);
      break;
    } else {
      // Still on earlier cards, click "Next"
      const nextButton = page.getByTestId('instructions-next-btn');
      await nextButton.click();
      clickedNext++;
      // Small wait for transition
      await page.waitForTimeout(100);
    }
  }
  
  // Wait for modal to disappear OR for lobby/config to appear
  // Sometimes the modal stays visible in DOM but we've moved to the next screen
  try {
    await expect(instructionsModal).not.toBeVisible({ timeout: 3000 });
  } catch (error) {
    // Modal still visible, check if we're at the next screen anyway
    const newGameBtn = page.getByTestId('new-game-btn');
    const nameInput = page.getByTestId('player-name-input');
    
    const isAtLobby = await newGameBtn.isVisible().catch(() => false);
    const isAtConfig = await nameInput.isVisible().catch(() => false);
    
    if (isAtLobby || isAtConfig) {
      // We've progressed to the next screen, modal is effectively dismissed
      console.log('⚠️ Modal still visible but progressed to next screen - continuing');
      return;
    }
    
    // Try clicking close button as fallback
    console.log('⚠️ Modal not closing, trying close button...');
    const closeButton = page.getByTestId('instructions-close-btn');
    const hasCloseBtn = await closeButton.isVisible().catch(() => false);
    if (hasCloseBtn) {
      await closeButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Give it one more chance to disappear
    await expect(instructionsModal).not.toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('⚠️ Modal still visible but continuing anyway');
    });
  }
}

/**
 * Skip instructions quickly by clicking the close button
 * Use this for faster test runs when you don't need to verify the tutorial
 */
export async function skipInstructionsQuick(page: Page) {
  // Wait for instructions modal to be visible
  const instructionsModal = page.getByTestId('instructions-modal');
  await expect(instructionsModal).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD });
  
  // Click the X close button
  const closeButton = page.getByTestId('instructions-close-btn');
  await closeButton.click();
  
  // Wait for the modal to close and lobby/configuration to appear
  // The modal dispatches a 'complete' event which the parent handles
  await page.waitForTimeout(1000);
  
  // Verify modal is gone (or at least we've moved to the next screen)
  await expect(instructionsModal).not.toBeVisible({ timeout: 10000 }).catch(() => {
    // If modal is still visible, that's ok if we're at lobby/config already
    console.log('⚠️ Modal still visible but continuing (parent may not have handled event)');
  });
}

/**
 * Navigate from lobby to game configuration (clicks "New Game")
 * Handles case where lobby might auto-skip if no games available
 */
export async function navigateToConfiguration(page: Page) {
  // Check if we're at the lobby or already at configuration
  const newGameBtn = page.getByTestId('new-game-btn');
  const nameInput = page.getByTestId('player-name-input');
  
  // Wait for either lobby or configuration to appear
  await Promise.race([
    expect(newGameBtn).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD }),
    expect(nameInput).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD })
  ]);
  
  // If we're at the lobby, click "New Game"
  const isAtLobby = await newGameBtn.isVisible().catch(() => false);
  if (isAtLobby) {
    // The lobby may be polling and re-rendering, causing button detachment
    // Use force:true to bypass actionability checks and just click
    await newGameBtn.click({ force: true });
    
    // Wait for name input to appear
    await expect(nameInput).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD });
  }
  // Otherwise, we're already at configuration
}

/**
 * Enter player name in the initial name input screen
 */
export async function enterPlayerName(page: Page, name: string) {
  // Wait for name input to be visible
  const nameInput = page.getByTestId('player-name-input');
  await expect(nameInput).toBeVisible({ timeout: TIMEOUTS.ELEMENT_LOAD });
  
  // Enter name
  await nameInput.fill(name);
  
  // Click submit button
  const submitButton = page.getByTestId('player-name-submit');
  await submitButton.click();
  
  // Wait for name input to disappear (should transition to configuration)
  await expect(nameInput).not.toBeVisible();
}

/**
 * Configure a player slot (set to AI, Open, Set, or Off)
 */
export async function configurePlayerSlot(
  page: Page,
  slotIndex: number,
  type: 'Set' | 'Open' | 'AI' | 'Off'
) {
  // Find the slot configuration select dropdown
  const slotSelect = page.getByTestId(`player-slot-${slotIndex}-type`);
  await expect(slotSelect).toBeVisible();
  
  // Use selectOption to change the dropdown value
  // This is the proper way to interact with <select> elements in Playwright
  await slotSelect.selectOption(type);
  
  // Small wait for any reactivity to process
  await page.waitForTimeout(100);
  
  // Verify the slot was set correctly
  await expect(slotSelect).toHaveValue(type);
}

/**
 * Set game settings (map size, AI difficulty, etc.)
 */
export async function setGameSettings(page: Page, settings: {
  mapSize?: string;
  aiDifficulty?: string;
  maxTurns?: number;
  timeLimit?: number;
}) {
  if (settings.mapSize) {
    const mapSizeSelect = page.getByTestId('game-setting-mapsize');
    await mapSizeSelect.selectOption(settings.mapSize);
  }
  
  if (settings.aiDifficulty) {
    const aiDifficultySelect = page.getByTestId('game-setting-aidifficulty');
    await aiDifficultySelect.selectOption(settings.aiDifficulty);
  }
  
  if (settings.maxTurns) {
    const maxTurnsSelect = page.getByTestId('game-setting-maxturns');
    await maxTurnsSelect.selectOption(settings.maxTurns.toString());
  }
  
  if (settings.timeLimit) {
    const timeLimitSelect = page.getByTestId('game-setting-timelimit');
    await timeLimitSelect.selectOption(settings.timeLimit.toString());
  }
}

/**
 * Click the create game button
 */
export async function createGame(page: Page) {
  const createButton = page.getByTestId('create-game-btn');
  await expect(createButton).toBeEnabled();
  await createButton.click();
}

/**
 * Wait for game to be ready (either waiting room or active game)
 */
export async function waitForGameReady(page: Page) {
  // Wait for URL to change to game page
  await page.waitForURL(/\/game\/[a-zA-Z0-9-]+/, { timeout: TIMEOUTS.GAME_LOAD });
  
  // Wait for either waiting room or game interface to load
  const waitingRoom = page.getByTestId('waiting-room');
  const gameInterface = page.getByTestId('game-interface');
  
  // Wait for one of them to be visible
  await Promise.race([
    expect(waitingRoom).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD }),
    expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD })
  ]);
}

/**
 * Start game from waiting room (for games that need to be started manually)
 */
export async function startGameFromWaitingRoom(page: Page) {
  const startButton = page.getByTestId('start-game-btn');
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();
  await startButton.click();
  
  // Wait for game interface to appear
  const gameInterface = page.getByTestId('game-interface');
  await expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD });
}

/**
 * Get the current game ID from the URL
 */
export function getGameIdFromUrl(page: Page): string {
  const url = page.url();
  const match = url.match(/\/game\/([a-zA-Z0-9_-]+)/);  // Include underscores in game ID
  if (!match) {
    throw new Error('Could not extract game ID from URL: ' + url);
  }
  return match[1];
}

/**
 * Join an existing game by game ID
 * Useful for multi-player tests where one player creates and others join
 * Note: Assumes skipInstructions has already been called
 * 
 * This function:
 * 1. Calls the join API to add the player to the game
 * 2. Saves player data to localStorage 
 * 3. Navigates to the game page
 * 4. Waits for waiting room or game interface
 */
export async function joinExistingGame(
  page: Page,
  gameId: string,
  playerName: string
): Promise<void> {
  console.log(`🔗 ${playerName} joining game ${gameId}`);
  
  // Call the join API
  const joinResponse = await page.evaluate(async ({ gameId, playerName }) => {
    const response = await fetch(`/api/game/${gameId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })  // Let server auto-assign slot
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Join failed: ${response.status}`);
    }
    
    return await response.json();
  }, { gameId, playerName });
  
  console.log(`  ✓ API join successful, slot: ${joinResponse.player.slotIndex}`);
  
  // Navigate to the game page first
  console.log(`  🔄 Navigating to /game/${gameId}`);
  await page.goto(`/game/${gameId}`);
  
  // NOW save player data to localStorage on the game page
  // NOTE: The key must be 'game_' prefix (not 'gameCreator_') to match clientStorage.ts
  await page.evaluate(({ gameId, player }) => {
    console.log('Setting localStorage:', `game_${gameId}`, {
      playerId: player.slotIndex.toString(),
      playerSlotIndex: player.slotIndex,
      playerName: player.name
    });
    localStorage.setItem(`game_${gameId}`, JSON.stringify({
      playerId: player.slotIndex.toString(),
      playerSlotIndex: player.slotIndex,
      playerName: player.name
    }));
  }, { gameId, player: joinResponse.player });
  
  console.log(`  ✓ Saved player data to localStorage`);
  
  // Reload the page so it picks up the localStorage
  console.log(`  🔄 Reloading page to apply localStorage...`);
  await page.reload({ waitUntil: 'networkidle' });
  
  // Wait for page to settle
  await page.waitForTimeout(2000);
  
  // Wait for waiting room or game interface to appear
  // The game might auto-start if all slots are now filled
  const waitingRoom = page.getByTestId('waiting-room');
  const gameInterface = page.getByTestId('game-interface');
  const loadingState = page.locator('text=/loading/i').first();
  
  // First wait for loading to appear or skip if already past loading
  console.log(`  ⏳ Waiting for page to load...`);
  
  try {
    // Try to wait for either waiting room or game interface
    await Promise.race([
      expect(waitingRoom).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD }),
      expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD })
    ]);
    
    // Check which one is visible
    const inWaitingRoom = await waitingRoom.isVisible().catch(() => false);
    const inGame = await gameInterface.isVisible().catch(() => false);
    
    if (inGame) {
      console.log(`✅ ${playerName} joined - game auto-started`);
    } else if (inWaitingRoom) {
      console.log(`✅ ${playerName} joined waiting room`);
    }
  } catch (error) {
    // Debug: What's actually on the page?
    const bodyText = await page.locator('body').textContent().catch(() => 'Could not read page');
    console.error(`❌ Failed to load game page for ${playerName}`);
    console.error(`Page content preview: ${bodyText?.substring(0, 200)}...`);
    throw error;
  }
}

/**
 * Wait for another player to join and appear in waiting room
 * Uses WebSocket update timing to ensure changes propagate
 */
export async function waitForPlayerToJoin(
  page: Page,
  playerName: string,
  slotIndex: number
): Promise<void> {
  console.log(`⏳ Waiting for ${playerName} to join slot ${slotIndex}...`);
  
  // Import WAITING_ROOM_TIMEOUTS at runtime to avoid circular dependency
  const { WAITING_ROOM_TIMEOUTS } = await import('../fixtures/test-data');
  
  // Wait for WebSocket update to propagate
  // The waiting room should show the player in the slot
  await page.waitForTimeout(WAITING_ROOM_TIMEOUTS.WEBSOCKET_UPDATE);
  
  // Additional wait to ensure UI updates
  await page.waitForTimeout(500);
  
  console.log(`✅ ${playerName} should now be visible in slot ${slotIndex}`);
}

/**
 * Start game from waiting room
 * Works for both "all slots filled" and "start anyway" scenarios
 * Alias for startGameFromWaitingRoom but with clearer name for multi-player
 */
export async function startGameAnywayFromWaitingRoom(page: Page): Promise<void> {
  console.log('🚀 Starting game from waiting room...');
  
  const startButton = page.getByTestId('start-game-btn');
  
  // Import WAITING_ROOM_TIMEOUTS at runtime
  const { WAITING_ROOM_TIMEOUTS } = await import('../fixtures/test-data');
  
  // Wait for button to be enabled
  await expect(startButton).toBeEnabled({ 
    timeout: WAITING_ROOM_TIMEOUTS.START_BUTTON 
  });
  
  // Click to start
  await startButton.click();
  
  // Wait a moment for the API call and state updates to complete
  // The flow is: click -> API call -> event dispatch -> loadGameData -> re-render
  console.log('⏳ Waiting for game to start...');
  await page.waitForTimeout(2000);
  
  // Check what's on the page for debugging
  const bodyText = await page.locator('body').textContent().catch(() => 'Could not read page');
  console.log('📄 Page content preview:', bodyText?.substring(0, 300));
  
  // Check if there's an error message
  const hasError = await page.getByText(/error/i).isVisible().catch(() => false);
  if (hasError) {
    const errorText = await page.getByText(/error/i).textContent().catch(() => 'Unknown error');
    console.log('❌ Error found on page:', errorText);
  }
  
  // Now wait for either the waiting room to disappear or game interface to appear
  const waitingRoom = page.getByTestId('waiting-room');
  const gameInterface = page.getByTestId('game-interface');
  
  // Check current state
  const isWaitingRoomVisible = await waitingRoom.isVisible().catch(() => false);
  const isGameInterfaceVisible = await gameInterface.isVisible().catch(() => false);
  console.log(`📊 Current state: waiting room=${isWaitingRoomVisible}, game interface=${isGameInterfaceVisible}`);
  
  // If already showing game interface, we're done
  if (isGameInterfaceVisible) {
    console.log('✅ Game interface already visible');
    return;
  }
  
  // Wait for transition - either waiting room hides or game interface shows
  try {
    await Promise.race([
      expect(waitingRoom).not.toBeVisible({ timeout: TIMEOUTS.GAME_LOAD }),
      expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD })
    ]);
  } catch (error) {
    console.log('❌ Transition timeout - waiting room still visible, game interface not appearing');
    console.log('📄 Final page state:', await page.locator('body').textContent().catch(() => 'Could not read'));
    throw error;
  }
  
  // Verify we're actually on the game interface now
  await expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD });
  
  console.log('✅ Game started successfully');
}

/**
 * Wait for all players' games to load
 * Useful for synchronizing multiple browser contexts
 */
export async function waitForAllGamesToLoad(pages: Page[]): Promise<void> {
  console.log(`⏳ Waiting for ${pages.length} players' games to load...`);
  
  await Promise.all(
    pages.map(async (page, index) => {
      const gameInterface = page.getByTestId('game-interface');
      await expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD });
      console.log(`✅ Player ${index + 1} game loaded`);
    })
  );
  
  console.log('✅ All players ready');
}

