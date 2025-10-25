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
  
  // Wait for modal to disappear
  await expect(instructionsModal).not.toBeVisible();
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
  
  // Wait for modal to disappear
  await expect(instructionsModal).not.toBeVisible();
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
    await newGameBtn.click();
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
  const match = url.match(/\/game\/([a-zA-Z0-9-]+)/);
  if (!match) {
    throw new Error('Could not extract game ID from URL: ' + url);
  }
  return match[1];
}

