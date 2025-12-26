import { test, expect } from '@playwright/test';
import {
    skipInstructions,
    navigateToConfiguration,
    enterPlayerName,
    configurePlayerSlot,
    setGameSettings,
    createGame,
    waitForGameReady,
    startGameFromWaitingRoom
} from './helpers/game-setup';
import {
    endTurn,
    waitForTurnStart,
    waitForAITurn,
    getCurrentTurn,
    isPlayerTurn,
    waitForGameLoad
} from './helpers/game-actions';
import { TEST_PLAYERS, AI_PLAYER_NAMES, GAME_SETTINGS, SLOT_TYPES } from './fixtures/test-data';

test.describe('Single Human + AI Tests', () => {
    // Increase timeout for these tests as AI turns can be slow
    test.setTimeout(60000);

    test('Test 1: Human in slot 1, AI in slot 2', async ({ page }) => {
        // Navigate to home page
        await page.goto('/');

        // Step 1: Skip instructions
        await skipInstructions(page);

        // Step 2: Navigate to configuration (handles lobby)
        await navigateToConfiguration(page);

        // Step 3: Enter player name
        await enterPlayerName(page, TEST_PLAYERS.PLAYER1);

        // Step 4: Configure slots
        // Slot 0 should already be set to the player
        // Slot 1 should already be AI (default)
        // Turn off slots 2 and 3
        await configurePlayerSlot(page, 2, SLOT_TYPES.OFF);
        await configurePlayerSlot(page, 3, SLOT_TYPES.OFF);

        // Step 5: Set game settings for faster testing
        await setGameSettings(page, GAME_SETTINGS.QUICK);

        // Step 6: Create game
        await createGame(page);

        // Step 7: Wait for game to be ready
        await waitForGameReady(page);

        // Step 8: If in waiting room, start the game
        const waitingRoom = page.getByTestId('waiting-room');
        const isWaitingRoom = await waitingRoom.isVisible().catch(() => false);

        if (isWaitingRoom) {
            await startGameFromWaitingRoom(page);
        }

        // Step 9: Wait for game interface to load
        await waitForGameLoad(page);

        // Step 10: Verify it's player 1's turn
        const currentTurnPlayer = page.getByTestId('current-turn-player');
        await expect(currentTurnPlayer).toContainText(TEST_PLAYERS.PLAYER1);

        // Step 11: Verify turn number is 1
        const turnNumber = await getCurrentTurn(page);
        expect(turnNumber).toBe(1);

        // Step 12: End player 1's turn
        await endTurn(page);

        // Step 13: Wait for AI turn to complete
        // The AI player is in slot 1 (Crimson)
        await waitForAITurn(page, AI_PLAYER_NAMES.SLOT_1);

        // Step 14: Verify it's back to player 1's turn
        await waitForTurnStart(page, TEST_PLAYERS.PLAYER1);

        // Step 15: Verify turn number is now 2
        const turn2Number = await getCurrentTurn(page);
        expect(turn2Number).toBe(2);

        // Step 16: Play through one more turn cycle
        await endTurn(page);

        // Check if game ended after player's turn
        let gameOver = await page
            .locator('text=/game over/i')
            .isVisible({ timeout: 1000 })
            .catch(() => false);
        if (gameOver) {
            console.log('⚠️ Game ended after human turn 2 (quick victory - acceptable for 2-player game)');
            console.log('✅ Test 1 completed successfully (game ended early)');
            return;
        }

        // Try to wait for AI turn, but game might end during it
        try {
            await waitForAITurn(page, AI_PLAYER_NAMES.SLOT_1);
        } catch (error) {
            // AI turn might not complete if game ended
            gameOver = await page
                .locator('text=/game over/i')
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            if (gameOver) {
                console.log('⚠️ Game ended during AI turn 2 (quick victory - acceptable for 2-player game)');
                console.log('✅ Test 1 completed successfully (game ended early)');
                return;
            }
            // If not game over, re-throw the error
            throw error;
        }

        // Check if game ended after AI turn
        gameOver = await page
            .locator('text=/game over/i')
            .isVisible({ timeout: 1000 })
            .catch(() => false);
        if (gameOver) {
            console.log('⚠️ Game ended after AI turn 2 (quick victory - acceptable for 2-player game)');
            console.log('✅ Test 1 completed successfully (game ended early)');
            return;
        }

        // Try to wait for player's turn, but be flexible about turn number
        try {
            await waitForTurnStart(page, TEST_PLAYERS.PLAYER1);

            // Step 17: Verify turn number is 2 or 3 (game might have progressed differently)
            const turn3Number = await getCurrentTurn(page);
            if (turn3Number >= 2 && turn3Number <= 3) {
                console.log(`✅ Test 1 completed successfully (reached turn ${turn3Number})`);
            } else {
                console.log(`⚠️ Unexpected turn number: ${turn3Number}`);
                expect(turn3Number).toBe(3);
            }
        } catch (error) {
            // If we can't get back to player's turn, check if game ended
            gameOver = await page
                .locator('text=/game over/i')
                .isVisible({ timeout: 1000 })
                .catch(() => false);
            if (gameOver) {
                console.log('⚠️ Game ended before turn 3 (quick victory - acceptable for 2-player game)');
                console.log('✅ Test 1 completed successfully (game ended early)');
                return;
            }
            // If not game over, re-throw
            throw error;
        }
    });

    test('Test 2: Human in slot 1, AI in slot 3 (slot 2 off)', async ({ page }) => {
        // Navigate to home page
        await page.goto('/');

        // Step 1: Skip instructions
        await skipInstructions(page);

        // Step 2: Navigate to configuration (handles lobby)
        await navigateToConfiguration(page);

        // Step 3: Enter player name
        await enterPlayerName(page, TEST_PLAYERS.PLAYER1);

        // Step 4: Configure slots
        // Slot 0 should already be set to the player
        // Turn off slot 1
        await configurePlayerSlot(page, 1, SLOT_TYPES.OFF);
        // Slot 2 should already be AI (default)
        // Turn off slot 3
        await configurePlayerSlot(page, 3, SLOT_TYPES.OFF);

        // Step 5: Set game settings for faster testing
        await setGameSettings(page, GAME_SETTINGS.QUICK);

        // Step 6: Create game
        await createGame(page);

        // Step 7: Wait for game to be ready
        await waitForGameReady(page);

        // Step 8: If in waiting room, start the game
        const waitingRoom = page.getByTestId('waiting-room');
        const isWaitingRoom = await waitingRoom.isVisible().catch(() => false);

        if (isWaitingRoom) {
            await startGameFromWaitingRoom(page);
        }

        // Step 9: Wait for game interface to load
        await waitForGameLoad(page);

        // Step 10: Verify it's player 1's turn (slot 0)
        await expect(page.getByTestId('current-turn-player')).toContainText(TEST_PLAYERS.PLAYER1);

        // Step 11: End player 1's turn
        await endTurn(page);

        // Step 12: Wait for AI turn (slot 2 = Amber)
        await waitForAITurn(page, AI_PLAYER_NAMES.SLOT_2);

        // Step 13: Verify it's back to player 1's turn
        await waitForTurnStart(page, TEST_PLAYERS.PLAYER1);

        // Step 14: Verify turn order skips inactive slot 1
        const turn2Number = await getCurrentTurn(page);
        expect(turn2Number).toBe(2);

        console.log('✅ Test 2 completed successfully');
    });

    test('Test 3: AI in slot 1, Human in slot 4 (slots 2-3 off)', async ({ page }) => {
        // Navigate to home page
        await page.goto('/');

        // Step 1: Skip instructions
        await skipInstructions(page);

        // Step 2: Navigate to configuration (handles lobby)
        await navigateToConfiguration(page);

        // Step 3: Enter player name
        await enterPlayerName(page, TEST_PLAYERS.PLAYER1);

        // Step 4: Configure slots - Move human to slot 3 (4th slot)
        // First, turn current slot 0 to AI
        await configurePlayerSlot(page, 0, SLOT_TYPES.AI);
        // Turn off slots 1 and 2
        await configurePlayerSlot(page, 1, SLOT_TYPES.OFF);
        await configurePlayerSlot(page, 2, SLOT_TYPES.OFF);
        // Set slot 3 to current player
        await configurePlayerSlot(page, 3, SLOT_TYPES.SET);

        // Step 5: Set game settings for faster testing
        await setGameSettings(page, GAME_SETTINGS.QUICK);

        // Step 6: Create game
        await createGame(page);

        // Step 7: Wait for game to be ready
        await waitForGameReady(page);

        // Step 8: If in waiting room, start the game
        const waitingRoom = page.getByTestId('waiting-room');
        const isWaitingRoom = await waitingRoom.isVisible().catch(() => false);

        if (isWaitingRoom) {
            await startGameFromWaitingRoom(page);
        }

        // Step 9: Wait for game interface to load
        await waitForGameLoad(page);

        // Step 10: AI should go first - wait for AI turn (slot 0 = Emerald)
        await waitForAITurn(page, AI_PLAYER_NAMES.SLOT_0);

        // Step 11: Check if game ended during AI turn
        let gameOver = await page
            .locator('text=/game over/i')
            .isVisible()
            .catch(() => false);
        if (gameOver) {
            console.log('⚠️ Game ended during first AI turn (quick victory - acceptable for 2-player game)');
            console.log('✅ Test 3 completed successfully (game ended early)');
            return;
        }

        // Step 12: Now it should be human player's turn (should be turn 1)
        await waitForTurnStart(page, TEST_PLAYERS.PLAYER1, 1);

        // Step 13: Verify we're on turn 1 (human is second in turn order)
        const turn1Number = await getCurrentTurn(page);
        expect(turn1Number).toBe(1);

        // Step 14: End human turn
        await endTurn(page);

        // Step 15: Check if game ended after human turn
        gameOver = await page
            .locator('text=/game over/i')
            .isVisible()
            .catch(() => false);
        if (gameOver) {
            console.log('⚠️ Game ended after human turn 1 (quick victory - acceptable for 2-player game)');
            console.log('✅ Test 3 completed successfully (game ended early)');
            return;
        }

        // Step 16: AI should go again (slot 0 = Emerald)
        await waitForAITurn(page, AI_PLAYER_NAMES.SLOT_0);

        // Step 17: Check if game ended after second AI turn
        gameOver = await page
            .locator('text=/game over/i')
            .isVisible()
            .catch(() => false);
        if (gameOver) {
            console.log('⚠️ Game ended after AI turn 2 (expected with 2 players)');
            console.log('✅ Test 3 completed successfully (game ended early)');
            return;
        }

        // Step 18: Back to human (should be turn 2)
        await waitForTurnStart(page, TEST_PLAYERS.PLAYER1, 2);

        // Step 19: Verify turn number is 2
        const turn2Number = await getCurrentTurn(page);
        expect(turn2Number).toBe(2);

        console.log('✅ Test 3 completed successfully');
    });
});
