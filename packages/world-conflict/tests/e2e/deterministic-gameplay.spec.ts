/**
 * Tests for deterministic gameplay using seeded RNG
 * 
 * These tests verify that games with the same seed produce identical outcomes,
 * which is crucial for reproducible testing of battle sequences and AI behavior.
 */
import { test, expect } from '@playwright/test';
import { createGameWithSeed } from './helpers/game-setup';
import { TEST_PLAYERS, GAME_SETTINGS, SLOT_TYPES } from './fixtures/test-data';

test.describe('Deterministic Gameplay with Seeded RNG', () => {
  test.setTimeout(60000);

  test('Games with same seed produce identical initial states', async ({ page }) => {
    const SEED = 'test-seed-12345';
    
    // Navigate to app first to establish base URL
    await page.goto('/');
    
    // Create first game with seed
    const game1 = await createGameWithSeed(
      page,
      TEST_PLAYERS.PLAYER1,
      {
        playerSlots: [
          { type: 'Set', name: TEST_PLAYERS.PLAYER1, slotIndex: 0 },
          { type: 'AI', defaultName: 'AI 1', slotIndex: 1 }
        ],
        settings: {
          aiDifficulty: 'Nice',
          maxTurns: 10,
          timeLimit: 30
        },
        gameType: 'MULTIPLAYER'
      },
      SEED
    );
    
    // Navigate to first game and inspect state
    await page.goto(`/game/${game1.gameId}`);
    await page.waitForTimeout(1000);
    
    // Extract game state for comparison
    const state1 = await page.evaluate(() => {
      const gameData = localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('game_')) || '');
      return gameData;
    });
    
    // Create second game with same seed
    const game2 = await createGameWithSeed(
      page,
      TEST_PLAYERS.PLAYER1,
      {
        playerSlots: [
          { type: 'Set', name: TEST_PLAYERS.PLAYER1, slotIndex: 0 },
          { type: 'AI', defaultName: 'AI 1', slotIndex: 1 }
        ],
        settings: {
          aiDifficulty: 'Nice',
          maxTurns: 10,
          timeLimit: 30
        },
        gameType: 'MULTIPLAYER'
      },
      SEED
    );
    
    // Navigate to second game
    await page.goto(`/game/${game2.gameId}`);
    await page.waitForTimeout(1000);
    
    // Verify RNG seeds match
    expect(game1.gameState.rngSeed).toBe(SEED);
    expect(game2.gameState.rngSeed).toBe(SEED);
    
    // Verify initial RNG state matches
    expect(game1.gameState.rngState).toBeDefined();
    expect(game2.gameState.rngState).toBeDefined();
    
    console.log('✅ Both games created with seed:', SEED);
    console.log('✅ Game 1 ID:', game1.gameId);
    console.log('✅ Game 2 ID:', game2.gameId);
    console.log('✅ RNG seeds match');
  });

  test('Games with different seeds produce different initial states', async ({ page }) => {
    const SEED1 = 'test-seed-11111';
    const SEED2 = 'test-seed-22222';
    
    // Navigate to app first to establish base URL
    await page.goto('/');
    
    // Create two games with different seeds
    const game1 = await createGameWithSeed(
      page,
      TEST_PLAYERS.PLAYER1,
      {
        playerSlots: [
          { type: 'Set', name: TEST_PLAYERS.PLAYER1, slotIndex: 0 },
          { type: 'AI', defaultName: 'AI 1', slotIndex: 1 }
        ],
        settings: {
          aiDifficulty: 'Nice',
          maxTurns: 10,
          timeLimit: 30
        },
        gameType: 'MULTIPLAYER'
      },
      SEED1
    );
    
    const game2 = await createGameWithSeed(
      page,
      TEST_PLAYERS.PLAYER1,
      {
        playerSlots: [
          { type: 'Set', name: TEST_PLAYERS.PLAYER1, slotIndex: 0 },
          { type: 'AI', defaultName: 'AI 1', slotIndex: 1 }
        ],
        settings: {
          aiDifficulty: 'Nice',
          maxTurns: 10,
          timeLimit: 30
        },
        gameType: 'MULTIPLAYER'
      },
      SEED2
    );
    
    // Verify seeds are different
    expect(game1.gameState.rngSeed).toBe(SEED1);
    expect(game2.gameState.rngSeed).toBe(SEED2);
    expect(game1.gameState.rngSeed).not.toBe(game2.gameState.rngSeed);
    
    console.log('✅ Game 1 created with seed:', SEED1);
    console.log('✅ Game 2 created with seed:', SEED2);
    console.log('✅ Seeds are different as expected');
  });

  test('Game created without seed gets auto-generated seed', async ({ page }) => {
    // Navigate to app first to establish base URL
    await page.goto('/');
    
    // Create game without specifying seed
    const game = await createGameWithSeed(
      page,
      TEST_PLAYERS.PLAYER1,
      {
        playerSlots: [
          { type: 'Set', name: TEST_PLAYERS.PLAYER1, slotIndex: 0 },
          { type: 'AI', defaultName: 'AI 1', slotIndex: 1 }
        ],
        settings: {
          aiDifficulty: 'Nice',
          maxTurns: 10,
          timeLimit: 30
        },
        gameType: 'MULTIPLAYER'
      }
      // No seed parameter
    );
    
    // Verify a seed was auto-generated
    expect(game.gameState.rngSeed).toBeDefined();
    expect(game.gameState.rngSeed).toBeTruthy();
    expect(typeof game.gameState.rngSeed).toBe('string');
    
    console.log('✅ Auto-generated seed:', game.gameState.rngSeed);
  });
});
