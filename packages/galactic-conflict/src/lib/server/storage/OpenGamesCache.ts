/**
 * Open Games Cache - Manages cached list of open games for efficient retrieval
 */

import type { Player, PendingGameConfiguration } from '$lib/game/entities/gameTypes';
import type { GameRecord } from './GameStorage';
import type { KVStorage } from './KVStorage';
import { logger } from 'multiplayer-framework/shared';

export const OPEN_GAMES_KEY = 'gc_open_games';

export interface OpenGamesList {
    games: Array<{
        gameId: string;
        status: 'PENDING';
        createdAt: number;
        playerCount: number;
        maxPlayers: number;
        gameType: 'MULTIPLAYER' | 'AI';
        // Include player data to avoid fetching full game records
        players?: Player[];
        pendingConfiguration?: PendingGameConfiguration;
    }>;
    lastUpdated: number;
}

/**
 * Create game info object for cache
 */
function createGameInfo(game: GameRecord): OpenGamesList['games'][0] {
    return {
        gameId: game.gameId,
        status: 'PENDING' as const,
        createdAt: game.createdAt,
        playerCount: game.players.length,
        maxPlayers: game.pendingConfiguration?.playerSlots?.length || 0,
        gameType: game.gameType,
        // Include player data and config to avoid fetching full game later
        players: game.players,
        pendingConfiguration: game.pendingConfiguration
    };
}

/**
 * Update the cached open games list when a game is added or modified
 */
export async function updateOpenGamesCache(
    game: GameRecord,
    storage: KVStorage
): Promise<void> {
    if (game.status !== 'PENDING' || !game.pendingConfiguration?.playerSlots) {
        return;
    }
    
    // Check if game has open slots
    const hasOpenSlots = game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open');
    if (!hasOpenSlots) {
        await removeFromOpenGamesCache(game.gameId, storage);
        return;
    }
    
    try {
        const currentList = await storage.get<OpenGamesList>(OPEN_GAMES_KEY) || {
            games: [],
            lastUpdated: Date.now()
        };
        
        const gameInfo = createGameInfo(game);
        
        const existingIndex = currentList.games.findIndex(g => g.gameId === game.gameId);
        if (existingIndex >= 0) {
            currentList.games[existingIndex] = gameInfo;
        } else {
            currentList.games.push(gameInfo);
        }
        
        currentList.lastUpdated = Date.now();
        await storage.put(OPEN_GAMES_KEY, currentList);
    } catch (error) {
        logger.warn(`Error updating open games cache for game ${game.gameId}:`, error);
    }
}

/**
 * Remove a game from the cached open games list
 */
export async function removeFromOpenGamesCache(
    gameId: string,
    storage: KVStorage
): Promise<void> {
    try {
        const currentList = await storage.get<OpenGamesList>(OPEN_GAMES_KEY);
        if (!currentList) return;
        
        currentList.games = currentList.games.filter(g => g.gameId !== gameId);
        currentList.lastUpdated = Date.now();
        
        await storage.put(OPEN_GAMES_KEY, currentList);
    } catch (error) {
        logger.warn(`Error removing game ${gameId} from open games cache:`, error);
    }
}

/**
 * Get the cached open games list
 */
export async function getOpenGamesCache(
    storage: KVStorage
): Promise<OpenGamesList | null> {
    return await storage.get<OpenGamesList>(OPEN_GAMES_KEY);
}

/**
 * Save the open games cache
 */
export async function saveOpenGamesCache(
    games: GameRecord[],
    storage: KVStorage
): Promise<void> {
    if (games.length === 0) {
        return;
    }

    await storage.put(OPEN_GAMES_KEY, {
        games: games.map(createGameInfo),
        lastUpdated: Date.now()
    });
}

