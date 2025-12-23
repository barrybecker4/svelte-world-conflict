/**
 * GameStorage - Persistence layer for Galactic Conflict games
 */

import type { Player } from '$lib/game/entities/gameTypes';
import { KVStorage } from './KVStorage';
import { GameStatsService } from './GameStatsService';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';
import { deleteStaleGames } from './deleteStaleGames';
import { updateOpenGamesCache, removeFromOpenGamesCache, getOpenGamesCache, saveOpenGamesCache, OPEN_GAMES_KEY, type OpenGamesList } from './OpenGamesCache';
import { updateActiveGamesCache, removeFromActiveGamesCache, getActiveGamesCache, saveActiveGamesCache } from './ActiveGamesCache';
import { addPlayerToGame as addPlayerToGameOp, removePlayerFromGame as removePlayerFromGameOp, canGameStart as canGameStartOp } from './GameRecordOperations';
import type { GameRecord } from './types';

const GAME_KEY_PREFIX = 'gc_game:';

export type { GameRecord };


export class GameStorage {
    private storage: KVStorage;
    private platform: App.Platform;

    constructor(platform: App.Platform) {
        this.storage = new KVStorage(platform);
        this.platform = platform;
    }

    static create(platform: App.Platform): GameStorage {
        return new GameStorage(platform);
    }

    /**
     * Get the stats service instance
     */
    private getStatsService(): GameStatsService | null {
        if (!this.platform) {
            return null;
        }
        return GameStatsService.create(this.platform);
    }

    /**
     * Save a game record
     */
    async saveGame(game: GameRecord): Promise<void> {
        const key = `${GAME_KEY_PREFIX}${game.gameId}`;

        // Check if status changed to COMPLETED
        const existingGame = await this.loadGame(game.gameId);
        const statusChanged = existingGame && existingGame.status !== game.status;

        game.lastUpdateAt = Date.now();
        await this.storage.put(key, game);

        // Update open games cache if status changed
        if (game.status === 'PENDING') {
            await updateOpenGamesCache(game, this.storage);
        } else {
            await removeFromOpenGamesCache(game.gameId, this.storage);
        }

        // Update active games cache
        if (game.status === 'ACTIVE') {
            await updateActiveGamesCache(game.gameId, this.storage);
        } else if (statusChanged && existingGame?.status === 'ACTIVE') {
            // Remove from active cache if transitioning away from ACTIVE
            await removeFromActiveGamesCache(game.gameId, this.storage);
        }

        // Record game completion statistics
        if (game.status === 'COMPLETED' && statusChanged) {
            logger.info(`Game ${game.gameId} completed - recording stats. endResult: ${JSON.stringify(game.gameState?.endResult)}`);
            const statsService = this.getStatsService();
            if (statsService) {
                await statsService.recordGameCompleted(game);
            } else {
                logger.warn(`No stats service available for game ${game.gameId}`);
            }
        }
    }


    /**
     * Load a game record
     */
    async loadGame(gameId: string): Promise<GameRecord | null> {
        const key = `${GAME_KEY_PREFIX}${gameId}`;
        return this.storage.get<GameRecord>(key);
    }

    /**
     * Delete a game record
     */
    async deleteGame(gameId: string): Promise<void> {
        const key = `${GAME_KEY_PREFIX}${gameId}`;
        await this.storage.delete(key);
        await removeFromOpenGamesCache(gameId, this.storage);
        await removeFromActiveGamesCache(gameId, this.storage);
    }

    /**
     * List all games (with optional status filter)
     * Optimized to reduce KV reads when possible
     */
    async listGames(status?: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<GameRecord[]> {
        // For PENDING games, use cached open games list if available
        if (status === 'PENDING') {
            return await this.getOpenGames();
        }

        // For ACTIVE games, use cached active games list if available
        if (status === 'ACTIVE') {
            return await this.getActiveGames();
        }

        // For other statuses (COMPLETED or no filter), we need to list all keys and read each game
        const result = await this.storage.list(GAME_KEY_PREFIX);
        const games: GameRecord[] = [];

        for (const key of result.keys) {
            const game = await this.storage.get<GameRecord>(key.name);
            if (game && (!status || game.status === status)) {
                games.push(game);
            }
        }

        return games;
    }

    /**
     * Check if a game is stale (created too long ago)
     */
    private isGameStale(createdAt: number, staleThreshold: number): boolean {
        return createdAt < staleThreshold;
    }

    /**
     * Check if a game has open slots
     */
    private hasOpenSlots(game: GameRecord | OpenGamesList['games'][0]): boolean {
        const config = 'pendingConfiguration' in game ? game.pendingConfiguration : game.pendingConfiguration;
        return config?.playerSlots?.some(slot => slot.type === 'Open') ?? false;
    }

    /**
     * Create minimal GameRecord from cached game info
     */
    private createGameRecordFromCache(gameInfo: OpenGamesList['games'][0]): GameRecord {
        return {
            gameId: gameInfo.gameId,
            status: 'PENDING',
            createdAt: gameInfo.createdAt,
            lastUpdateAt: gameInfo.createdAt,
            players: gameInfo.players || [],
            gameType: gameInfo.gameType,
            pendingConfiguration: gameInfo.pendingConfiguration
        };
    }

    /**
     * Get open games from cache
     */
    private async getOpenGamesFromCache(staleThreshold: number): Promise<GameRecord[] | null> {
        try {
            const cachedList = await getOpenGamesCache(this.storage);

            if (!cachedList || cachedList.games.length === 0) {
                return null;
            }

            const now = Date.now();
            const validGames: GameRecord[] = [];
            const gamesStillOpen: typeof cachedList.games = [];
            const staleGameIds: string[] = [];

            for (const gameInfo of cachedList.games) {
                // Check if game is stale (created too long ago)
                if (this.isGameStale(gameInfo.createdAt, staleThreshold)) {
                    logger.debug(`Game ${gameInfo.gameId} is stale (created ${now - gameInfo.createdAt}ms ago)`);
                    staleGameIds.push(gameInfo.gameId);
                    continue;
                }

                // Check if still has open slots (data now in cached list)
                if (this.hasOpenSlots(gameInfo)) {
                    validGames.push(this.createGameRecordFromCache(gameInfo));
                    gamesStillOpen.push(gameInfo);
                }
            }

            // Delete stale games
            await deleteStaleGames(staleGameIds, this);

            // Update cache if entries changed
            if (gamesStillOpen.length !== cachedList.games.length) {
                await this.storage.put(OPEN_GAMES_KEY, {
                    games: gamesStillOpen,
                    lastUpdated: Date.now()
                });
            }

            return validGames;
        } catch (error) {
            logger.warn('Error reading cached open games list, falling back to full scan:', error);
            return null;
        }
    }

    /**
     * Get open games from full scan (fallback)
     */
    private async getOpenGamesFromFullScan(staleThreshold: number): Promise<GameRecord[]> {
        const now = Date.now();
        const result = await this.storage.list(GAME_KEY_PREFIX);
        const openGames: GameRecord[] = [];
        const staleGameIds: string[] = [];

        for (const key of result.keys) {
            const game = await this.storage.get<GameRecord>(key.name);
            if (game && game.status === 'PENDING' && game.pendingConfiguration?.playerSlots) {
                // Check if game is stale
                if (this.isGameStale(game.createdAt, staleThreshold)) {
                    logger.debug(`Game ${game.gameId} is stale (created ${now - game.createdAt}ms ago)`);
                    staleGameIds.push(game.gameId);
                    continue;
                }

                if (this.hasOpenSlots(game)) {
                    openGames.push(game);
                }
            }
        }

        // Delete stale games found during full scan
        await deleteStaleGames(staleGameIds, this);

        // Cache the results for next time
        await saveOpenGamesCache(openGames, this.storage);

        return openGames;
    }

    /**
     * Get list of open games (PENDING status with open slots)
     * Uses cached list to reduce KV reads
     * Automatically removes stale games (not joined within STALE_GAME_TIMEOUT_MS)
     */
    async getOpenGames(): Promise<GameRecord[]> {
        const now = Date.now();
        const staleThreshold = now - GALACTIC_CONSTANTS.STALE_GAME_TIMEOUT_MS;

        // Try to get from cache first
        const cachedGames = await this.getOpenGamesFromCache(staleThreshold);
        if (cachedGames !== null) {
            return cachedGames;
        }

        // Fallback to full scan
        return await this.getOpenGamesFromFullScan(staleThreshold);
    }

    /**
     * Get list of active games
     * Uses cached list to reduce KV list operations
     */
    async getActiveGames(): Promise<GameRecord[]> {
        try {
            // Try to get from cache first
            const cachedList = await getActiveGamesCache(this.storage);
            
            if (cachedList && cachedList.gameIds.length > 0) {
                // Read each game record from the cached IDs
                const games: GameRecord[] = [];
                for (const gameId of cachedList.gameIds) {
                    const game = await this.loadGame(gameId);
                    if (game && game.status === 'ACTIVE') {
                        games.push(game);
                    } else if (game && game.status !== 'ACTIVE') {
                        // Cache is stale - game is no longer active, remove it
                        logger.debug(`Removing ${gameId} from active cache (status: ${game?.status})`);
                        await removeFromActiveGamesCache(gameId, this.storage);
                    }
                }
                return games;
            }

            // Cache miss or empty - fall back to full scan
            logger.info('Active games cache miss - performing full KV scan');
            return await this.getActiveGamesFromFullScan();
            
        } catch (error) {
            logger.warn('Error reading cached active games list, falling back to full scan:', error);
            return await this.getActiveGamesFromFullScan();
        }
    }

    /**
     * Get active games from full scan (fallback when cache is missing)
     */
    private async getActiveGamesFromFullScan(): Promise<GameRecord[]> {
        const result = await this.storage.list(GAME_KEY_PREFIX);
        const activeGames: GameRecord[] = [];
        const activeGameIds: string[] = [];

        for (const key of result.keys) {
            const game = await this.storage.get<GameRecord>(key.name);
            if (game && game.status === 'ACTIVE') {
                activeGames.push(game);
                activeGameIds.push(game.gameId);
            }
        }

        // Rebuild cache for next time
        await saveActiveGamesCache(activeGameIds, this.storage);

        return activeGames;
    }

    /**
     * Update game status
     */
    async updateGameStatus(gameId: string, status: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<void> {
        const game = await this.loadGame(gameId);
        if (game) {
            game.status = status;
            await this.saveGame(game);
        }
    }

    /**
     * Add a player to a pending game
     */
    async addPlayerToGame(gameId: string, player: Player, slotIndex: number): Promise<boolean> {
        const game = await this.loadGame(gameId);

        if (!game) {
            logger.warn(`Cannot add player to game ${gameId}: game not found`);
            return false;
        }

        return await addPlayerToGameOp(game, player, slotIndex, (g) => this.saveGame(g));
    }

    /**
     * Remove a player from a pending game
     */
    async removePlayerFromGame(gameId: string, slotIndex: number): Promise<boolean> {
        const game = await this.loadGame(gameId);

        if (!game) {
            return false;
        }

        return await removePlayerFromGameOp(game, slotIndex, (g) => this.saveGame(g));
    }

    /**
     * Check if all slots are filled and game can start
     */
    async canGameStart(gameId: string): Promise<boolean> {
        const game = await this.loadGame(gameId);

        if (!game) {
            return false;
        }

        return canGameStartOp(game);
    }
}
