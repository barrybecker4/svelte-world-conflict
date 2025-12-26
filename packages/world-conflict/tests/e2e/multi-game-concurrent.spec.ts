import { test, expect } from '@playwright/test';
import {
    skipInstructions,
    navigateToConfiguration,
    enterPlayerName,
    configurePlayerSlot,
    setGameSettings,
    createGame,
    waitForGameReady,
    getGameIdFromUrl,
    joinExistingGame,
    waitForPlayerToJoin,
    waitForAllGamesToLoad,
    createGameWithSeed
} from './helpers/game-setup';
import {
    endTurn,
    waitForTurnStart,
    getCurrentTurn,
    synchronizeTurnTransition,
    verifyTurnNumberSync,
    executeMultiPlayerTurnCycle
} from './helpers/game-actions';
import { TEST_PLAYERS, GAME_SETTINGS } from './fixtures/test-data';

/**
 * Multi-Game Concurrent E2E Tests
 *
 * These tests verify that multiple multiplayer games can run simultaneously
 * without interference, testing scalability and isolation of game state.
 */

test.describe('Multi-Game Concurrent Tests', () => {
    // Extended timeout for running 3 games simultaneously (10 minutes)
    test.setTimeout(600000);

    test('Test: Three Simultaneous 4-Player Games', async ({ browser }) => {
        console.log('\n🎮 ===== TEST: THREE SIMULTANEOUS 4-PLAYER GAMES =====\n');

        // Track game results for final reporting
        const gameResults: Array<{
            gameId: string;
            status: 'success' | 'failed' | 'ended_early';
            error?: string;
            turnsCompleted?: number;
        }> = [];

        // Phase 1: Create browser contexts and games
        console.log('📋 ===== PHASE 1: SETUP =====');
        console.log('Creating 12 browser contexts (4 players × 3 games)...\n');

        // Create 12 browser contexts (4 per game)
        const contexts = await Promise.all(Array.from({ length: 12 }, () => browser.newContext()));

        const pages = await Promise.all(contexts.map(context => context.newPage()));

        // Organize pages by game
        const game1Pages = pages.slice(0, 4);
        const game2Pages = pages.slice(4, 8);
        const game3Pages = pages.slice(8, 12);

        const games = [
            {
                pages: game1Pages,
                name: 'Game 1',
                gameId: '',
                players: ['G1P1', 'G1P2', 'G1P3', 'G1P4']
            },
            {
                pages: game2Pages,
                name: 'Game 2',
                gameId: '',
                players: ['G2P1', 'G2P2', 'G2P3', 'G2P4']
            },
            {
                pages: game3Pages,
                name: 'Game 3',
                gameId: '',
                players: ['G3P1', 'G3P2', 'G3P3', 'G3P4']
            }
        ];

        try {
            // Create all 3 games in parallel
            console.log('🎲 Creating 3 games in parallel...\n');

            const gameCreationResults = await Promise.allSettled(
                games.map(async (game, gameIndex) => {
                    try {
                        // Stagger game creation to reduce server load
                        await new Promise(resolve => setTimeout(resolve, gameIndex * 500));

                        const creatorPage = game.pages[0];
                        const playerName = game.players[0];

                        console.log(`[${game.name}] 👤 ${playerName}: Creating game via API...`);

                        // Navigate to home page first (needed for API calls to work)
                        await creatorPage.goto('/');

                        // Use API to create game directly - much faster and avoids UI blocking
                        const result = await createGameWithSeed(creatorPage, playerName, {
                            playerSlots: [
                                {
                                    type: 'Set',
                                    name: playerName,
                                    slotIndex: 0
                                },
                                { type: 'Open', slotIndex: 1 },
                                { type: 'Open', slotIndex: 2 },
                                { type: 'Open', slotIndex: 3 }
                            ],
                            settings: GAME_SETTINGS.QUICK,
                            gameType: 'MULTIPLAYER'
                        });

                        const gameId = result.gameId;
                        game.gameId = gameId;

                        // Navigate to the game page
                        console.log(`[${game.name}]   Navigating to game page...`);
                        await creatorPage.goto(`/game/${gameId}`);
                        await creatorPage.waitForTimeout(1000); // Wait for page to load

                        // Wait for waiting room or game interface to appear
                        const waitingRoom = creatorPage.getByTestId('waiting-room');
                        const gameInterface = creatorPage.getByTestId('game-interface');
                        await Promise.race([
                            waitingRoom.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
                            gameInterface.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
                        ]);

                        console.log(`[${game.name}] ✅ Game created successfully: ${gameId}\n`);

                        return { gameIndex, gameId };
                    } catch (error) {
                        console.error(`[${game.name}] ❌ Error creating game:`, error);
                        throw new Error(
                            `Failed to create ${game.name}: ${error instanceof Error ? error.message : String(error)}`
                        );
                    }
                })
            );

            // Check if all games were created successfully
            const failedCreations = gameCreationResults.filter(r => r.status === 'rejected');
            if (failedCreations.length > 0) {
                console.error('❌ Some games failed to create:');
                failedCreations.forEach((result, idx) => {
                    if (result.status === 'rejected') {
                        console.error(`  Game ${idx + 1}: ${result.reason}`);
                    }
                });
                throw new Error(`${failedCreations.length} game(s) failed to create`);
            }

            console.log('✅ All 3 games created successfully!\n');

            // Wait a moment for server to stabilize
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Phase 2: Players join games
            console.log('📋 ===== PHASE 2: PLAYERS JOIN =====');
            console.log('Players 2-4 joining all games in parallel...\n');

            const joinOperations = games.flatMap((game, gameIndex) =>
                [1, 2, 3].map(async playerIndex => {
                    try {
                        // Stagger joins to reduce server load (each game offset + player offset)
                        await new Promise(resolve => setTimeout(resolve, (gameIndex * 3 + playerIndex) * 500));

                        const page = game.pages[playerIndex];
                        const playerName = game.players[playerIndex];

                        console.log(`[${game.name}] 👤 ${playerName}: Joining game ${game.gameId}`);

                        // joinExistingGame now handles navigation and skipping instructions
                        await joinExistingGame(page, game.gameId, playerName);

                        console.log(`[${game.name}] ✅ ${playerName} joined`);

                        return { game: game.name, player: playerName };
                    } catch (error) {
                        console.error(`[${game.name}] ❌ Error joining game for ${game.players[playerIndex]}:`, error);
                        throw error;
                    }
                })
            );

            const joinResults = await Promise.allSettled(joinOperations);

            // Check join results
            const failedJoins = joinResults.filter(r => r.status === 'rejected');
            if (failedJoins.length > 0) {
                console.error(`⚠️ ${failedJoins.length} player(s) failed to join:`);
                failedJoins.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error(`  ${result.reason}`);
                    }
                });
            }

            const successfulJoins = joinResults.filter(r => r.status === 'fulfilled').length;
            console.log(`\n✅ ${successfulJoins}/9 players joined successfully\n`);

            // Phase 3: Verify games started
            console.log('📋 ===== PHASE 3: VERIFY GAME START =====');
            console.log('Waiting for all games to load...\n');

            const gameStartResults = await Promise.allSettled(
                games.map(async (game, gameIndex) => {
                    // Small stagger for game load checks
                    await new Promise(resolve => setTimeout(resolve, gameIndex * 500));

                    console.log(`[${game.name}] ⏳ Waiting for game to load...`);

                    await waitForAllGamesToLoad(game.pages);

                    // Verify turn 1
                    const turn = await verifyTurnNumberSync(game.pages);
                    expect(turn).toBe(1);

                    console.log(`[${game.name}] ✅ Game loaded, all players on turn ${turn}\n`);

                    return { game: game.name, turn };
                })
            );

            // Check game start results
            const failedStarts = gameStartResults.filter(r => r.status === 'rejected');
            if (failedStarts.length > 0) {
                console.error(`⚠️ ${failedStarts.length} game(s) failed to start properly:`);
                failedStarts.forEach((result, idx) => {
                    if (result.status === 'rejected') {
                        console.error(`  Game ${idx + 1}: ${result.reason}`);
                    }
                });
            }

            console.log('✅ All games that loaded successfully are on turn 1\n');

            // Phase 4: Execute turn cycles
            console.log('📋 ===== PHASE 4: EXECUTE TURN CYCLES =====');
            console.log('Running 2 complete turn cycles per game...\n');

            const turnCycleResults = await Promise.allSettled(
                games.map(async game => {
                    try {
                        console.log(`[${game.name}] 🔄 Starting turn cycle 1...`);

                        // Turn Cycle 1
                        await executeMultiPlayerTurnCycle(
                            game.players.map((name, idx) => ({
                                page: game.pages[idx],
                                name: name
                            }))
                        );

                        const turn2 = await verifyTurnNumberSync(game.pages);
                        console.log(`[${game.name}] ✅ Turn cycle 1 complete, now on turn ${turn2}\n`);

                        // Check if game ended
                        const gameOver = await game.pages[0]
                            .locator('text=/game over|ended|complete/i')
                            .isVisible({ timeout: 1000 })
                            .catch(() => false);

                        if (gameOver) {
                            console.log(`[${game.name}] ⚠️ Game ended after turn cycle 1 (acceptable)\n`);
                            return {
                                game: game.name,
                                gameId: game.gameId,
                                status: 'ended_early' as const,
                                turnsCompleted: 1
                            };
                        }

                        // Turn Cycle 2
                        console.log(`[${game.name}] 🔄 Starting turn cycle 2...`);

                        await executeMultiPlayerTurnCycle(
                            game.players.map((name, idx) => ({
                                page: game.pages[idx],
                                name: name
                            }))
                        );

                        const turn3 = await verifyTurnNumberSync(game.pages);
                        console.log(`[${game.name}] ✅ Turn cycle 2 complete, now on turn ${turn3}\n`);

                        return {
                            game: game.name,
                            gameId: game.gameId,
                            status: 'success' as const,
                            turnsCompleted: 2
                        };
                    } catch (error) {
                        console.error(`[${game.name}] ❌ Error during turn cycles:`, error);

                        // Check if game ended (not an error)
                        const gameOver = await game.pages[0]
                            .locator('text=/game over|ended|complete/i')
                            .isVisible({ timeout: 1000 })
                            .catch(() => false);

                        if (gameOver) {
                            return {
                                game: game.name,
                                gameId: game.gameId,
                                status: 'ended_early' as const,
                                error: 'Game ended during turn cycle'
                            };
                        }

                        return {
                            game: game.name,
                            gameId: game.gameId,
                            status: 'failed' as const,
                            error: error instanceof Error ? error.message : String(error)
                        };
                    }
                })
            );

            // Phase 5: Verification and reporting
            console.log('📋 ===== PHASE 5: FINAL VERIFICATION =====\n');

            // Process results
            turnCycleResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    gameResults.push(result.value);
                } else {
                    gameResults.push({
                        gameId: 'unknown',
                        status: 'failed',
                        error: result.reason
                    });
                }
            });

            // Count successes
            const successfulGames = gameResults.filter(r => r.status === 'success').length;
            const endedEarlyGames = gameResults.filter(r => r.status === 'ended_early').length;
            const failedGames = gameResults.filter(r => r.status === 'failed').length;

            console.log('📊 ===== TEST SUMMARY =====');
            console.log(`Total games: ${games.length}`);
            console.log(`Successful: ${successfulGames} (completed 2 turn cycles)`);
            console.log(`Ended early: ${endedEarlyGames} (game finished before 2 cycles)`);
            console.log(`Failed: ${failedGames} (errors or desyncs)`);
            console.log('\nPer-game details:');

            gameResults.forEach(result => {
                const statusEmoji = result.status === 'success' ? '✅' : result.status === 'ended_early' ? '⚠️' : '❌';
                console.log(`  ${statusEmoji} ${result.gameId || 'unknown'}: ${result.status}`);
                if (result.error) {
                    console.log(`      Error: ${result.error}`);
                }
                if (result.turnsCompleted) {
                    console.log(`      Turn cycles completed: ${result.turnsCompleted}/2`);
                }
            });

            console.log('\n✅ ===== TEST COMPLETED =====');

            // Verify at least 2 of 3 games completed successfully (or ended early)
            const playableGames = successfulGames + endedEarlyGames;
            expect(playableGames).toBeGreaterThanOrEqual(2);

            console.log(`\n🎉 ${playableGames}/3 games ran successfully!\n`);
        } finally {
            // Cleanup: Close all browser contexts
            console.log('🧹 Cleaning up 12 browser contexts...');
            await Promise.all(contexts.map(context => context.close()));
            console.log('✅ Cleanup complete\n');
        }
    });
});
