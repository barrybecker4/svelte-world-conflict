import { KVStorage } from './KVStorage';
import { GameStatsService } from './GameStatsService';
import { cleanupOldGames } from './GameCleanup';
import type { Player } from '$lib/game/state/GameState';
import { logger } from 'multiplayer-framework/shared';

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
            // SAFETY CHECK: If game has endResult but status is not COMPLETED, fix it
            const hasEndResult = game.worldConflictState?.endResult != null;
            if (hasEndResult && game.status !== 'COMPLETED') {
                logger.warn(
                    `Game ${game.gameId} has endResult but status is ${game.status}. Auto-fixing to COMPLETED.`
                );
                game.status = 'COMPLETED';
            }

            logger.debug(`Saving game ${game.gameId} with status: ${game.status}`);

            // Get previous game state to check if status changed
            const previousGame = await this.getGame(game.gameId);
            const statusChanged = !previousGame || previousGame.status !== game.status;

            if (game.status === 'COMPLETED') {
                logger.info(
                    `Saving COMPLETED game ${game.gameId}. statusChanged=${statusChanged}, previousStatus=${previousGame?.status}`
                );
            }

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
                    logger.info(
                        `Game ${game.gameId} completed - recording stats. endResult: ${JSON.stringify(game.worldConflictState.endResult)}`
                    );
                    const statsService = this.getStatsService();
                    if (statsService) {
                        await statsService.recordGameCompleted(game);
                    } else {
                        logger.warn(`No stats service available for game ${game.gameId}`);
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

            // OPTIMIZATION: Return game records from the cached list instead of fetching each full game.
            // This reduces KV reads from (1 + N games) to just 1 read per lobby poll.
            // The list now contains all the info needed for the lobby display (players, pendingConfiguration).
            const minimalGames: GameRecord[] = openGamesList.games.map(gameInfo => ({
                gameId: gameInfo.gameId,
                status: gameInfo.status as 'PENDING' | 'ACTIVE' | 'COMPLETED',
                createdAt: gameInfo.createdAt,
                lastMoveAt: gameInfo.createdAt, // Use createdAt as fallback
                players: gameInfo.players || [], // Now included in the cached list
                worldConflictState: {} as any, // Not needed for lobby list
                gameType: gameInfo.gameType,
                currentPlayerSlot: 0, // Not relevant for pending games
                pendingConfiguration: gameInfo.pendingConfiguration // Now included in the cached list
            }));

            return minimalGames;
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
            const currentList = (await this.kv.get<OpenGamesList>('wc_games:open')) || {
                games: [],
                lastUpdated: Date.now()
            };

            const gameInfo: OpenGameInfo = {
                gameId: game.gameId,
                status: game.status,
                createdAt: game.createdAt,
                playerCount: game.players.length,
                maxPlayers: 4,
                gameType: game.gameType,
                // Include player data and config to avoid fetching full game later
                players: game.players,
                pendingConfiguration: game.pendingConfiguration
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
