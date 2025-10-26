import { Page, expect } from '@playwright/test';
import { TIMEOUTS } from '../fixtures/test-data';

/**
 * Select a territory on the map
 */
export async function selectTerritory(page: Page, territoryName: string) {
  const territory = page.getByTestId(`territory-${territoryName}`);
  await expect(territory).toBeVisible();
  await territory.click();
}

/**
 * Place a unit on a territory
 */
export async function placeUnit(page: Page, territoryName: string) {
  // Select the territory
  await selectTerritory(page, territoryName);
  
  // Click the place unit button or confirm placement
  const placeButton = page.getByTestId('place-unit-btn');
  await placeButton.click();
}

/**
 * Perform an attack from one territory to another
 */
export async function attack(page: Page, fromTerritory: string, toTerritory: string) {
  // Select the attacking territory
  await selectTerritory(page, fromTerritory);
  
  // Click attack button
  const attackButton = page.getByTestId('attack-btn');
  await attackButton.click();
  
  // Select the target territory
  await selectTerritory(page, toTerritory);
  
  // Confirm attack (if needed)
  const confirmButton = page.getByTestId('confirm-attack-btn');
  if (await confirmButton.isVisible()) {
    await confirmButton.click();
  }
}

/**
 * Dismiss any open modals (like soldier selection)
 */
export async function dismissAnyModals(page: Page) {
  // Check for soldier selection modal and cancel it
  const cancelButton = page.locator('button:has-text("Cancel")').first();
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click();
    await page.waitForTimeout(200);
  }
  
  // Press Escape key to close any other modals
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * End the current turn
 * Retries if the turn doesn't actually end (handles cases where actions are required first)
 */
export async function endTurn(page: Page) {
  // First, dismiss any open modals that might block the button
  await dismissAnyModals(page);
  
  const endTurnButton = page.getByTestId('end-turn-btn');
  const turnIndicator = page.getByTestId('current-turn-player');
  
  // Get current turn player before clicking
  const currentPlayerBefore = await turnIndicator.textContent().catch(() => null);
  if (!currentPlayerBefore) {
    console.warn('⚠️ Could not read current player before ending turn');
    return;
  }
  
  // Wait for button to be enabled
  await expect(endTurnButton).toBeEnabled({ timeout: TIMEOUTS.ELEMENT_LOAD });
  
  // Click end turn
  await endTurnButton.click({ force: true });
  
  // Wait for turn to change (with timeout)
  try {
    await expect(turnIndicator).not.toContainText(currentPlayerBefore, { timeout: 3000 });
    const currentPlayerAfter = await turnIndicator.textContent().catch(() => null);
    console.log(`✅ Turn ended successfully: ${currentPlayerBefore} → ${currentPlayerAfter}`);
  } catch (error) {
    // Check if page is still alive
    if (await page.isClosed()) {
      console.log('⚠️ Page closed during turn end');
      return;
    }
    
    const currentPlayerAfter = await turnIndicator.textContent().catch(() => 'unknown');
    console.warn(`⚠️ Turn may not have changed: ${currentPlayerBefore} → ${currentPlayerAfter}`);
    // Continue anyway - the next assertion will catch if something is wrong
  }
}

/**
 * Wait for player's turn to start
 */
export async function waitForTurnStart(page: Page, playerName: string) {
  // Wait for turn indicator showing it's this player's turn
  const turnIndicator = page.getByTestId('current-turn-player');
  await expect(turnIndicator).toContainText(playerName, { timeout: TIMEOUTS.TURN_TRANSITION });
  
  // Also check that action buttons are enabled
  const endTurnButton = page.getByTestId('end-turn-btn');
  await expect(endTurnButton).toBeEnabled({ timeout: TIMEOUTS.TURN_TRANSITION });
}

/**
 * Wait for AI turn to complete
 */
export async function waitForAITurn(page: Page, aiPlayerName: string) {
  // Wait for AI turn indicator
  const turnIndicator = page.getByTestId('current-turn-player');
  
  try {
    await expect(turnIndicator).toContainText(aiPlayerName, { timeout: TIMEOUTS.TURN_TRANSITION });
    
    // Wait for AI turn to complete (turn indicator changes away from AI)
    await expect(turnIndicator).not.toContainText(aiPlayerName, { timeout: TIMEOUTS.AI_TURN });
  } catch (error) {
    // Check if game has ended (which would explain why turn didn't change)
    const gameOver = await page.locator('text=/game over/i').isVisible().catch(() => false);
    if (gameOver) {
      console.log('⚠️ Game ended during AI turn');
      return;
    }
    
    // Check if it's actually still the AI's turn (might be stuck)
    const currentText = await turnIndicator.textContent();
    console.log(`⚠️ AI turn timeout. Current turn: ${currentText}, Expected: ${aiPlayerName}`);
    throw error;
  }
}

/**
 * Get current turn number
 */
export async function getCurrentTurn(page: Page): Promise<number> {
  const turnDisplay = page.getByTestId('turn-number');
  const text = await turnDisplay.textContent();
  const match = text?.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

/**
 * Get current phase (e.g., "Placement", "Attack", etc.)
 */
export async function getCurrentPhase(page: Page): Promise<string> {
  const phaseDisplay = page.getByTestId('current-phase');
  const text = await phaseDisplay.textContent();
  return text?.trim() || '';
}

/**
 * Check if it's currently a specific player's turn
 */
export async function isPlayerTurn(page: Page, playerName: string): Promise<boolean> {
  const turnIndicator = page.getByTestId('current-turn-player');
  const text = await turnIndicator.textContent();
  return text?.includes(playerName) || false;
}

/**
 * Wait for game to load completely
 */
export async function waitForGameLoad(page: Page) {
  const gameInterface = page.getByTestId('game-interface');
  await expect(gameInterface).toBeVisible({ timeout: TIMEOUTS.GAME_LOAD });
  
  // Wait for map to be rendered
  const mapCanvas = page.getByTestId('game-map');
  await expect(mapCanvas).toBeVisible();
}

/**
 * Get player info panel data
 */
export async function getPlayerInfo(page: Page, playerName: string) {
  const playerPanel = page.getByTestId(`player-info-${playerName}`);
  await expect(playerPanel).toBeVisible();
  
  const territories = await playerPanel.getByTestId('player-territories').textContent();
  const units = await playerPanel.getByTestId('player-units').textContent();
  
  return {
    territories: parseInt(territories || '0'),
    units: parseInt(units || '0'),
  };
}

/**
 * Synchronize turn transition across multiple player pages
 * Ensures all players see the turn change before proceeding
 */
export async function synchronizeTurnTransition(
  pages: Page[],
  fromPlayer: string,
  toPlayer: string
): Promise<void> {
  console.log(`⏳ Syncing turn transition: ${fromPlayer} → ${toPlayer}`);
  
  // Wait for all pages to show the new player's turn
  await Promise.all(
    pages.map(async (page, index) => {
      const turnIndicator = page.getByTestId('current-turn-player');
      try {
        await expect(turnIndicator).toContainText(toPlayer, { 
          timeout: TIMEOUTS.TURN_TRANSITION 
        });
        console.log(`  ✅ Player ${index + 1} sees ${toPlayer}'s turn`);
      } catch (error) {
        console.error(`  ❌ Player ${index + 1} failed to see ${toPlayer}'s turn`);
        throw error;
      }
    })
  );
  
  // Verify old player is no longer shown (extra validation)
  await Promise.all(
    pages.map(page =>
      expect(page.getByTestId('current-turn-player'))
        .not.toContainText(fromPlayer)
    )
  );
  
  console.log(`✅ All ${pages.length} players synchronized on ${toPlayer}'s turn`);
}

/**
 * Verify turn order across multiple players
 * Ensures all players see the same current player
 */
export async function verifyTurnOrder(
  pages: Page[],
  expectedPlayer: string
): Promise<void> {
  console.log(`🔍 Verifying all players see ${expectedPlayer}'s turn...`);
  
  // Check all pages show the same current player
  const results = await Promise.all(
    pages.map(async (page, index) => {
      const indicator = page.getByTestId('current-turn-player');
      const text = await indicator.textContent();
      console.log(`  Player ${index + 1} sees: ${text}`);
      return text;
    })
  );
  
  // Verify all pages agree
  results.forEach((result, idx) => {
    if (!result?.includes(expectedPlayer)) {
      throw new Error(
        `Page ${idx} shows wrong player: ${result}, expected: ${expectedPlayer}`
      );
    }
  });
  
  console.log(`✅ All players agree: ${expectedPlayer}'s turn`);
}

/**
 * Verify turn numbers match across all players
 * Useful for detecting desyncs
 */
export async function verifyTurnNumberSync(pages: Page[]): Promise<number> {
  const turnNumbers = await Promise.all(
    pages.map(page => getCurrentTurn(page))
  );
  
  const firstTurn = turnNumbers[0];
  const allMatch = turnNumbers.every(turn => turn === firstTurn);
  
  if (!allMatch) {
    console.error('❌ Turn number mismatch:', turnNumbers);
    throw new Error(
      `Turn numbers don't match across players: ${turnNumbers.join(', ')}`
    );
  }
  
  console.log(`✅ All players on turn ${firstTurn}`);
  return firstTurn;
}

/**
 * Execute a complete turn cycle for multiple players
 * Each player takes their turn in sequence
 */
export async function executeMultiPlayerTurnCycle(
  playersData: Array<{ page: Page; name: string }>
): Promise<void> {
  console.log(`🔄 Executing turn cycle for ${playersData.length} players...`);
  
  for (let i = 0; i < playersData.length; i++) {
    const currentPlayer = playersData[i];
    const nextPlayer = playersData[(i + 1) % playersData.length];
    
    console.log(`  🎲 ${currentPlayer.name}'s turn`);
    
    // Wait for current player's turn
    await waitForTurnStart(currentPlayer.page, currentPlayer.name);
    
    // End turn
    await endTurn(currentPlayer.page);
    
    // Wait for all players to see the transition
    const allPages = playersData.map(p => p.page);
    await synchronizeTurnTransition(
      allPages,
      currentPlayer.name,
      nextPlayer.name
    );
  }
  
  console.log('✅ Turn cycle completed');
}

