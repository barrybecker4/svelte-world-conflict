import { KVStorage } from './KVStorage';
import { GameStatsService } from './GameStatsService';
import { cleanupOldGames } from './GameCleanup';
import type { Player } from '$lib/game/state/GameState';
import { logger } from '$lib/game/utils/logger';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Re-export types for backward compatibility
export type { GameRecord, OpenGamesList, OpenGameInfo, MoveMetadata } from './types';
import type { GameRecord, OpenGamesList, OpenGameInfo } from './types';

export class GameStorage {
    private kv: KVStorage;
    private platform: App.Platform | null = null;

    constructor(kv: KVStorage, platform?: App.Platform) {
        this.kv = kv;
        this.platform = platform || null;
    }

    /**
     * Create a game storage instance with platform auto-configuration
     */
    static create(platform: App.Platform): GameStorage {
        const kv = new KVStorage(platform);
        return new GameStorage(kv, platform);
    }

    /**
     * Get the stats service for recording game statistics
     */
    private getStatsService(): GameStatsService | null {
        if (!this.platform) {
            logger.warn('No platform available for GameStatsService');
            return null;
        }
        return GameStatsService.create(this.platform);
    }

    async getGame(gameId: string): Promise<GameRecord | null> {
        try {
            return await this.kv.get<GameRecord>(`wc_game:${gameId}`);
        } catch (error) {
            logger.error(`Error getting World Conflict game ${gameId}:`, error);
            return null;
        }
    }

    async saveGame(game: GameRecord): Promise<void> {
        try {
            logger.debug(`Saving game ${game.gameId} with status: ${game.status}`);

            // Get previous game state to check if status changed
            const previousGame = await this.getGame(game.gameId);
            const statusChanged = !previousGame || previousGame.status !== game.status;

            await this.kv.put(`wc_game:${game.gameId}`, game);

            // Update open games list ONLY if game status changed
            if (statusChanged) {
                if (game.status === 'ACTIVE' || game.status === 'COMPLETED') {
                    await this.removeFromOpenGamesList(game.gameId);
                } else if (game.status === 'PENDING') {
                    await this.addToOpenGamesList(game);
                }

                // Record game completion statistics and run cleanup
                if (game.status === 'COMPLETED') {
                    const statsService = this.getStatsService();
                    if (statsService) {
                        await statsService.recordGameCompleted(game);
                    }

                    // Fire-and-forget cleanup of old games (14+ days old)
                    if (this.platform) {
                        cleanupOldGames(this.platform, FOURTEEN_DAYS_MS, false).catch(error => {
                            logger.error('Background cleanup failed:', error);
                        });
                    }
                }
            }
        } catch (error) {
            logger.error(`Error saving World Conflict game ${game.gameId}:`, error);
            throw error;
        }
    }

    async getOpenGames(): Promise<GameRecord[]> {
        try {
            const openGamesList = await this.kv.get<OpenGamesList>('wc_games:open');
            if (!openGamesList) return [];

            const validGames: GameRecord[] = [];
            const gamesStillOpen: OpenGameInfo[] = [];

            for (const gameInfo of openGamesList.games) {
                const fullGame = await this.getGame(gameInfo.gameId);
                if (fullGame && fullGame.status === 'PENDING') {
                    validGames.push(fullGame);
                    gamesStillOpen.push(gameInfo);
                }
            }

            // Update the open games list to remove invalid entries
            if (gamesStillOpen.length !== openGamesList.games.length) {
                await this.kv.put('wc_games:open', {
                    games: gamesStillOpen,
                    lastUpdated: Date.now()
                });
            }

            return validGames;
        } catch (error) {
            logger.error('Error getting open World Conflict games:', error);
            return [];
        }
    }

    async addPlayerToGame(gameId: string, player: Player): Promise<GameRecord | null> {
        try {
            const game = await this.getGame(gameId);
            if (!game) return null;

            // Check if player already in game
            if (game.players.some(p => p.slotIndex === player.slotIndex)) {
                return game;
            }

            // Add player
            game.players.push(player);
            game.lastMoveAt = Date.now();

            await this.saveGame(game);
            return game;
        } catch (error) {
            logger.error(`Error adding player to game ${gameId}:`, error);
            return null;
        }
    }

    private async addToOpenGamesList(game: GameRecord): Promise<void> {
        if (game.status !== 'PENDING') return;

        try {
            const currentList = await this.kv.get<OpenGamesList>('wc_games:open') || {
                games: [],
                lastUpdated: Date.now()
            };

            const gameInfo: OpenGameInfo = {
                gameId: game.gameId,
                status: game.status,
                createdAt: game.createdAt,
                playerCount: game.players.length,
                maxPlayers: 4,
                gameType: game.gameType
            };

            // Check if already exists
            const existingIndex = currentList.games.findIndex(g => g.gameId === game.gameId);
            if (existingIndex >= 0) {
                currentList.games[existingIndex] = gameInfo;
            } else {
                currentList.games.push(gameInfo);
            }

            currentList.lastUpdated = Date.now();
            await this.kv.put('wc_games:open', currentList);
        } catch (error) {
            logger.error(`Error adding game ${game.gameId} to open games list:`, error);
        }
    }

    private async removeFromOpenGamesList(gameId: string): Promise<void> {
        try {
            const currentList = await this.kv.get<OpenGamesList>('wc_games:open');
            if (!currentList) return;

            currentList.games = currentList.games.filter(g => g.gameId !== gameId);
            currentList.lastUpdated = Date.now();

            await this.kv.put('wc_games:open', currentList);
        } catch (error) {
            logger.error(`Error removing game ${gameId} from open games list:`, error);
        }
    }

    async deleteGame(gameId: string): Promise<void> {
        try {
            const game = await this.getGame(gameId);
            if (!game) return;

            // Record as abandoned if game was not completed
            if (game.status !== 'COMPLETED') {
                const statsService = this.getStatsService();
                if (statsService) {
                    await statsService.recordGameAbandoned(gameId);
                }
            }

            await this.kv.delete(`wc_game:${gameId}`);
            await this.removeFromOpenGamesList(gameId);
        } catch (error) {
            logger.error(`Error deleting World Conflict game ${gameId}:`, error);
            throw error;
        }
    }

    async getGamesByStatus(status: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<GameRecord[]> {
        try {
            if (status === 'PENDING') {
                return await this.getOpenGames();
            }

            // For other statuses, search through the open games list
            const openGamesList = await this.kv.get<OpenGamesList>('wc_games:open');
            if (!openGamesList) return [];

            const matchingGames: GameRecord[] = [];

            for (const gameInfo of openGamesList.games) {
                const fullGame = await this.getGame(gameInfo.gameId);
                if (fullGame && fullGame.status === status) {
                    matchingGames.push(fullGame);
                }
            }

            return matchingGames;
        } catch (error) {
            logger.error(`Error getting World Conflict games with status ${status}:`, error);
            return [];
        }
    }
}
