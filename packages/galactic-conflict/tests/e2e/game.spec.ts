/**
 * End-to-end tests for Galactic Conflict
 */

import { test, expect } from '@playwright/test';

test.describe('Galactic Conflict Game', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display game instructions on first load', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Galactic Conflict/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Start Playing/i })).toBeVisible();
    });

    test('should navigate to lobby after dismissing instructions', async ({ page }) => {
        // Enter name
        await page.getByPlaceholder(/Commander name/i).fill('TestPlayer');
        await page.getByRole('button', { name: /Continue/i }).click();

        // Should show lobby or configuration
        await expect(page.getByRole('heading', { name: /New Game|Select a game/i })).toBeVisible();
    });

    test('should create a new game', async ({ page }) => {
        // Dismiss instructions
        await page.getByRole('button', { name: /Start Playing/i }).click();

        // Enter name
        await page.getByPlaceholder(/Commander name/i).fill('TestPlayer');
        await page.getByRole('button', { name: /Continue/i }).click();

        // Go to new game configuration
        await page.getByRole('button', { name: /New Game/i }).click();

        // Configure game
        await expect(page.getByRole('heading', { name: /New Game/i })).toBeVisible();
        
        // Create game
        await page.getByRole('button', { name: /Create Game/i }).click();

        // Should navigate to game or waiting room
        await expect(page.url()).toContain('/game/');
    });

    test('should display galaxy map in active game', async ({ page }) => {
        // Dismiss instructions
        await page.getByRole('button', { name: /Start Playing/i }).click();

        // Enter name
        await page.getByPlaceholder(/Commander name/i).fill('TestPlayer');
        await page.getByRole('button', { name: /Continue/i }).click();

        // Create new game with AI opponent
        await page.getByRole('button', { name: /New Game/i }).click();
        await page.getByRole('button', { name: /Create Game/i }).click();

        // Wait for game to load
        await page.waitForURL(/\/game\//);

        // Galaxy map should be visible
        await expect(page.locator('.galaxy-map, .game-container')).toBeVisible();
    });
});

test.describe('Game Mechanics', () => {
    // These tests would require setting up a game first
    // and interacting with planets and armadas

    test.skip('should allow selecting planets', async ({ page }) => {
        // TODO: Implement after game setup
    });

    test.skip('should allow sending armadas', async ({ page }) => {
        // TODO: Implement after game setup
    });

    test.skip('should allow building ships', async ({ page }) => {
        // TODO: Implement after game setup
    });
});
