/**
 * GameStorage - Persistence layer for Galactic Conflict games
 */

import type { GalacticGameStateData, Player, PendingGameConfiguration } from '$lib/game/entities/gameTypes';
import { KVStorage } from './KVStorage';
import { GameStatsService } from './GameStatsService';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { logger } from 'multiplayer-framework/shared';

const GAME_KEY_PREFIX = 'gc_game:';
const OPEN_GAMES_KEY = 'gc_open_games';

interface OpenGamesList {
    games: Array<{
        gameId: string;
        status: 'PENDING';
        createdAt: number;
        playerCount: number;
        maxPlayers: number;
        gameType: 'MULTIPLAYER' | 'AI';
    }>;
    lastUpdated: number;
}

export interface GameRecord {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    players: Player[];
    gameState?: GalacticGameStateData;
    createdAt: number;
    lastUpdateAt: number;
    gameType: 'MULTIPLAYER' | 'AI';
    pendingConfiguration?: PendingGameConfiguration;
}

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
            await this.updateOpenGamesCache(game);
        } else {
            await this.removeFromOpenGamesCache(game.gameId);
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
     * Update the cached open games list when a game is added or modified
     */
    private async updateOpenGamesCache(game: GameRecord): Promise<void> {
        if (game.status !== 'PENDING' || !game.pendingConfiguration?.playerSlots) {
            return;
        }
        
        // Check if game has open slots
        const hasOpenSlots = game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open');
        if (!hasOpenSlots) {
            await this.removeFromOpenGamesCache(game.gameId);
            return;
        }
        
        try {
            const currentList = await this.storage.get<OpenGamesList>(OPEN_GAMES_KEY) || {
                games: [],
                lastUpdated: Date.now()
            };
            
            const gameInfo = {
                gameId: game.gameId,
                status: 'PENDING' as const,
                createdAt: game.createdAt,
                playerCount: game.players.length,
                maxPlayers: game.pendingConfiguration.playerSlots.length,
                gameType: game.gameType
            };
            
            const existingIndex = currentList.games.findIndex(g => g.gameId === game.gameId);
            if (existingIndex >= 0) {
                currentList.games[existingIndex] = gameInfo;
            } else {
                currentList.games.push(gameInfo);
            }
            
            currentList.lastUpdated = Date.now();
            await this.storage.put(OPEN_GAMES_KEY, currentList);
        } catch (error) {
            logger.warn(`Error updating open games cache for game ${game.gameId}:`, error);
        }
    }
    
    /**
     * Remove a game from the cached open games list
     */
    private async removeFromOpenGamesCache(gameId: string): Promise<void> {
        try {
            const currentList = await this.storage.get<OpenGamesList>(OPEN_GAMES_KEY);
            if (!currentList) return;
            
            currentList.games = currentList.games.filter(g => g.gameId !== gameId);
            currentList.lastUpdated = Date.now();
            
            await this.storage.put(OPEN_GAMES_KEY, currentList);
        } catch (error) {
            logger.warn(`Error removing game ${gameId} from open games cache:`, error);
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
        await this.removeFromOpenGamesCache(gameId);
    }

    /**
     * List all games (with optional status filter)
     * Optimized to reduce KV reads when possible
     */
    async listGames(status?: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<GameRecord[]> {
        // For PENDING games, use cached open games list if available
        if (status === 'PENDING') {
            const openGames = await this.getOpenGames();
            return openGames;
        }

        // For other statuses, we need to list all keys and read each game
        // This is necessary for ACTIVE games used by event processing
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
     * Get list of open games (PENDING status with open slots)
     * Uses cached list to reduce KV reads
     * Automatically removes stale games (not joined within STALE_GAME_TIMEOUT_MS)
     */
    async getOpenGames(): Promise<GameRecord[]> {
        const now = Date.now();
        const staleThreshold = now - GALACTIC_CONSTANTS.STALE_GAME_TIMEOUT_MS;
        const staleGameIds: string[] = [];

        try {
            // Try to get cached open games list first
            const cachedList = await this.storage.get<OpenGamesList>(OPEN_GAMES_KEY);
            
            if (cachedList && cachedList.games.length > 0) {
                // Validate cached entries and fetch full game records
                const validGames: GameRecord[] = [];
                const gamesStillOpen: typeof cachedList.games = [];

                for (const gameInfo of cachedList.games) {
                    const fullGame = await this.loadGame(gameInfo.gameId);
                    if (fullGame && fullGame.status === 'PENDING') {
                        // Check if game is stale (created too long ago)
                        if (fullGame.createdAt < staleThreshold) {
                            logger.debug(`Game ${fullGame.gameId} is stale (created ${now - fullGame.createdAt}ms ago)`);
                            staleGameIds.push(fullGame.gameId);
                            continue;
                        }

                        // Check if still has open slots
                        if (fullGame.pendingConfiguration?.playerSlots?.some(slot => slot.type === 'Open')) {
                            validGames.push(fullGame);
                            gamesStillOpen.push(gameInfo);
                        }
                    }
                }

                // Delete stale games
                if (staleGameIds.length > 0) {
                    logger.info(`Removing ${staleGameIds.length} stale game(s) from storage`);
                    for (const gameId of staleGameIds) {
                        try {
                            await this.deleteGame(gameId);
                        } catch (error) {
                            logger.error(`Failed to delete stale game ${gameId}:`, error);
                        }
                    }
                }

                // Update cache if entries changed
                if (gamesStillOpen.length !== cachedList.games.length) {
                    await this.storage.put(OPEN_GAMES_KEY, {
                        games: gamesStillOpen,
                        lastUpdated: Date.now()
                    });
                }

                return validGames;
            }
        } catch (error) {
            logger.warn('Error reading cached open games list, falling back to full scan:', error);
        }

        // Fallback: scan all games (less efficient but reliable)
        const result = await this.storage.list(GAME_KEY_PREFIX);
        const openGames: GameRecord[] = [];

        for (const key of result.keys) {
            const game = await this.storage.get<GameRecord>(key.name);
            if (game && game.status === 'PENDING' && game.pendingConfiguration?.playerSlots) {
                // Check if game is stale
                if (game.createdAt < staleThreshold) {
                    logger.debug(`Game ${game.gameId} is stale (created ${now - game.createdAt}ms ago)`);
                    staleGameIds.push(game.gameId);
                    continue;
                }

                if (game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open')) {
                    openGames.push(game);
                }
            }
        }

        // Delete stale games found during full scan
        if (staleGameIds.length > 0) {
            logger.info(`Removing ${staleGameIds.length} stale game(s) from storage`);
            for (const gameId of staleGameIds) {
                try {
                    await this.deleteGame(gameId);
                } catch (error) {
                    logger.error(`Failed to delete stale game ${gameId}:`, error);
                }
            }
        }

        // Cache the results for next time
        if (openGames.length > 0) {
            await this.storage.put(OPEN_GAMES_KEY, {
                games: openGames.map(g => ({
                    gameId: g.gameId,
                    status: 'PENDING' as const,
                    createdAt: g.createdAt,
                    playerCount: g.players.length,
                    maxPlayers: g.pendingConfiguration?.playerSlots?.length || 0,
                    gameType: g.gameType
                })),
                lastUpdated: Date.now()
            });
        }

        return openGames;
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
        
        if (!game || game.status !== 'PENDING') {
            logger.warn(`Cannot add player to game ${gameId}: game not found or not pending`);
            return false;
        }

        if (!game.pendingConfiguration?.playerSlots) {
            logger.warn(`Cannot add player to game ${gameId}: no pending configuration`);
            return false;
        }

        // Find the slot and verify it's open
        const slot = game.pendingConfiguration.playerSlots.find(s => s.slotIndex === slotIndex);
        if (!slot || slot.type !== 'Open') {
            logger.warn(`Cannot add player to slot ${slotIndex}: slot not found or not open`);
            return false;
        }

        // Update slot to Set (human player)
        slot.type = 'Set';
        slot.name = player.name;

        // Add player to players array
        game.players.push(player);

        await this.saveGame(game);
        logger.debug(`Added player ${player.name} to game ${gameId} at slot ${slotIndex}`);
        
        return true;
    }

    /**
     * Remove a player from a pending game
     */
    async removePlayerFromGame(gameId: string, slotIndex: number): Promise<boolean> {
        const game = await this.loadGame(gameId);
        
        if (!game || game.status !== 'PENDING') {
            return false;
        }

        if (!game.pendingConfiguration?.playerSlots) {
            return false;
        }

        // Find the slot
        const slot = game.pendingConfiguration.playerSlots.find(s => s.slotIndex === slotIndex);
        if (!slot || slot.type !== 'Set') {
            return false;
        }

        // Reset slot to Open
        slot.type = 'Open';
        delete slot.name;

        // Remove player from players array
        game.players = game.players.filter(p => p.slotIndex !== slotIndex);

        await this.saveGame(game);
        return true;
    }

    /**
     * Check if all slots are filled and game can start
     */
    async canGameStart(gameId: string): Promise<boolean> {
        const game = await this.loadGame(gameId);
        
        if (!game || game.status !== 'PENDING') {
            return false;
        }

        if (!game.pendingConfiguration?.playerSlots) {
            return false;
        }

        // Check if any slots are still Open
        return !game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open');
    }
}

