import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GameStatsService } from '$lib/server/storage/GameStatsService';
import { GameStorage } from '$lib/server/storage/GameStorage';
import { logger } from 'multiplayer-framework/shared';
import { VERSION } from '$lib/version';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';

// Stats fix version - increment this when making stats-related fixes
const STATS_FIX_VERSION = '2025-11-30-v8';

/**
 * GET: Get daily stats for today or a specific date
 * Query params:
 * - date: YYYY-MM-DD format (default: today)
 * - days: Get stats for last N days (default: 1)
 */
export const GET: RequestHandler = async ({ url, platform }) => {
    try {
        const statsService = GameStatsService.create(platform!);
        
        const days = parseInt(url.searchParams.get('days') || '1');
        
        if (days > 1) {
            const stats = await statsService.getStatsForLastNDays(days);
            return json({ stats });
        }
        
        const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const stats = await statsService.getDailyStats(date);
        
        return json({
            version: VERSION,
            statsFixVersion: STATS_FIX_VERSION,
            ...(stats || { error: 'No stats found for this date', date })
        });
    } catch (error) {
        logger.error('Error getting stats:', error);
        return json({ error: 'Failed to get stats' }, { status: 500 });
    }
};

/**
 * POST: Test recording a game completion (for debugging)
 * This creates a mock completed game and records it to verify the flow works
 */
export const POST: RequestHandler = async ({ url, platform }) => {
    try {
        const action = url.searchParams.get('action');
        
        if (action === 'test-completion') {
            // Create a mock completed game to test the recording flow
            const statsService = GameStatsService.create(platform!);
            
            const mockGame = {
                gameId: `test-${Date.now()}`,
                status: 'COMPLETED' as const,
                players: [
                    { slotIndex: 0, name: 'TestHuman', isAI: false, color: '#ff0000' },
                    { slotIndex: 1, name: 'TestAI', isAI: true, color: '#00ff00' }
                ],
                worldConflictState: {
                    id: 1,
                    gameId: `test-${Date.now()}`,
                    turnNumber: 5,
                    currentPlayerSlot: 0,
                    movesRemaining: 0,
                    ownersByRegion: {},
                    templesByRegion: {},
                    soldiersByRegion: {},
                    faithByPlayer: {},
                    players: [
                        { slotIndex: 0, name: 'TestHuman', isAI: false, color: '#ff0000' },
                        { slotIndex: 1, name: 'TestAI', isAI: true, color: '#00ff00' }
                    ],
                    regions: [],
                    endResult: { slotIndex: 0, name: 'TestHuman', isAI: false, color: '#ff0000' }
                },
                createdAt: Date.now(),
                lastMoveAt: Date.now(),
                currentPlayerSlot: 0,
                gameType: 'AI' as const
            };
            
            await statsService.recordGameCompleted(mockGame);
            
            const date = new Date().toISOString().split('T')[0];
            const stats = await statsService.getDailyStats(date);
            
            return json({
                success: true,
                message: 'Test completion recorded',
                stats
            });
        }
        
        if (action === 'diagnose-game') {
            // Diagnose why a specific game didn't end
            const gameId = url.searchParams.get('gameId');
            if (!gameId) {
                return json({ error: 'gameId required' }, { status: 400 });
            }
            
            const gameStorage = GameStorage.create(platform!);
            const game = await gameStorage.getGame(gameId);
            if (!game) {
                return json({ error: 'Game not found' }, { status: 404 });
            }
            
            const gameState = game.worldConflictState;
            const players = game.players;
            
            // Test checkGameEnd with the current state
            const gameEndResult = checkGameEnd(gameState, players);
            
            // Calculate what the turn limit check sees
            const turnNumber = gameState.turnNumber;
            const maxTurns = gameState.maxTurns ?? 0;
            const currentTurn = turnNumber + 1;
            
            return json({
                gameId,
                status: game.status,
                turnNumber,
                maxTurns,
                currentTurn,
                comparison: `${currentTurn} >= ${maxTurns} = ${currentTurn >= maxTurns}`,
                storedEndResult: gameState.endResult,
                checkGameEndResult: gameEndResult,
                playerCount: players.length,
                activePlayers: players.filter(p => {
                    const regions = Object.values(gameState.ownersByRegion).filter(o => o === p.slotIndex);
                    return regions.length > 0;
                }).map(p => ({ name: p.name, slotIndex: p.slotIndex }))
            });
        }
        
        if (action === 'check-games') {
            // List recent games and their statuses
            const gameStorage = GameStorage.create(platform!);
            const games: any[] = [];
            
            // This is a diagnostic to see what games exist and their statuses
            try {
                const kv = (platform as any)?.env?.WORLD_CONFLICT_KV;
                if (kv) {
                    const list = await kv.list({ prefix: 'wc_game:' });
                    // Get all games (up to 50)
                    for (const key of list.keys.slice(0, 50)) {
                        const game = await gameStorage.getGame(key.name.replace('wc_game:', ''));
                        if (game) {
                            games.push({
                                gameId: game.gameId,
                                status: game.status,
                                hasEndResult: !!game.worldConflictState?.endResult,
                                endResult: game.worldConflictState?.endResult,
                                turnNumber: game.worldConflictState?.turnNumber,
                                maxTurns: game.worldConflictState?.maxTurns,
                                playerCount: game.players?.length,
                                createdAt: game.createdAt
                            });
                        }
                    }
                    // Sort by createdAt descending (newest first)
                    games.sort((a, b) => b.createdAt - a.createdAt);
                    // Convert timestamps to ISO strings and limit to 15
                    const recentGames = games.slice(0, 15).map(g => ({
                        ...g,
                        createdAt: new Date(g.createdAt).toISOString()
                    }));
                    return json({ 
                        totalGames: games.length,
                        recentGames 
                    });
                }
            } catch (e) {
                logger.error('Error listing games:', e);
            }
            
            return json({ games: [], error: 'Could not list games' });
        }
        
        return json({ error: 'Unknown action. Use ?action=test-completion or ?action=check-games' }, { status: 400 });
    } catch (error) {
        logger.error('Error in stats action:', error);
        return json({ error: 'Failed to perform action' }, { status: 500 });
    }
};
