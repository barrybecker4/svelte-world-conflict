import type { WorldConflictKVStorage } from './kv.ts';
import type { Player, WorldConflictGameStateData } from '$lib/game/WorldConflictGameState.ts';

export interface WorldConflictGameRecord {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    players: Player[];
    worldConflictState: WorldConflictGameStateData;
    createdAt: number;
    lastMoveAt: number;
    currentPlayerIndex: number;
    gameType: 'MULTIPLAYER' | 'AI';

    // Optional configuration for PENDING games that need to be completed
    pendingConfiguration?: {
        playerSlots: Array<{
            index: number;
            type: 'Off' | 'Set' | 'Open' | 'AI';
            name: string;
            customName?: string;
        }>;
        mapSize: string;
        aiDifficulty: string;
    };
}

export interface OpenWorldConflictGamesList {
    games: Array<{
        gameId: string;
        status: string;
        createdAt: number;
        playerCount: number;
        maxPlayers: number;
        gameType: 'MULTIPLAYER' | 'AI';
    }>;
    lastUpdated: number;
}

export class WorldConflictGameStorage {
    private kv: WorldConflictKVStorage;

    constructor(kv: WorldConflictKVStorage) {
        this.kv = kv;
    }

    async getGame(gameId: string): Promise<WorldConflictGameRecord | null> {
        try {
            return await this.kv.get<WorldConflictGameRecord>(`wc_game:${gameId}`);
        } catch (error) {
            console.error(`Error getting World Conflict game ${gameId}:`, error);
            return null;
        }
    }

    async saveGame(game: WorldConflictGameRecord): Promise<void> {
        try {
            console.log(`Saving World Conflict game ${game.gameId} with status: ${game.status}`);

            await this.kv.put(`wc_game:${game.gameId}`, game);

            // Update open games list if game status changed
            if (game.status === 'ACTIVE' || game.status === 'COMPLETED') {
                await this.removeFromOpenGamesList(game.gameId);
            } else if (game.status === 'PENDING') {
                await this.addToOpenGamesList(game);
            }
        } catch (error) {
            console.error(`Error saving World Conflict game ${game.gameId}:`, error);
            throw error;
        }
    }

    async getOpenGames(): Promise<WorldConflictGameRecord[]> {
        try {
            const openGamesList = await this.kv.get<OpenWorldConflictGamesList>('wc_games:open');
            if (!openGamesList) return [];

            const validGames: WorldConflictGameRecord[] = [];
            const gamesStillOpen: typeof openGamesList.games = [];

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
            console.error('Error getting open World Conflict games:', error);
            return [];
        }
    }

    async findGameForPlayer(playerId: string): Promise<WorldConflictGameRecord | null> {
        try {
            // Check if player has an active game
            const gameId = await this.kv.get<string>(`wc_player:${playerId}:game`);
            if (gameId) {
                const game = await this.getGame(gameId);
                if (game && (game.status === 'ACTIVE' || game.status === 'PENDING')) {
                    return game;
                }
            }

            // Look for an open game to join
            const openGames = await this.getOpenGames();
            for (const game of openGames) {
                if (game.players.length < 4) { // Max 4 players for World Conflict
                    return game;
                }
            }

            return null;
        } catch (error) {
            console.error(`Error finding game for player ${playerId}:`, error);
            return null;
        }
    }

    async addPlayerToGame(gameId: string, player: Player): Promise<WorldConflictGameRecord | null> {
        try {
            const game = await this.getGame(gameId);
            if (!game) return null;

            // Check if player already in game
            if (game.players.some(p => p.index === player.index)) {
                return game;
            }

            // Add player
            game.players.push(player);
            game.lastMoveAt = Date.now();

            // Keep game PENDING until all slots filled or creator starts anyway
            // Game only becomes ACTIVE when:
            // 1. All open slots are filled with human players, OR
            // 2. Creator clicks "Start anyway" (handled in separate endpoint)

            // Map player to game
            await this.kv.put(`wc_player:${player.index}:game`, gameId);

            await this.saveGame(game);
            return game;
        } catch (error) {
            console.error(`Error adding player to game ${gameId}:`, error);
            return null;
        }
    }

    private async addToOpenGamesList(game: WorldConflictGameRecord): Promise<void> {
        if (game.status !== 'PENDING') return;

        try {
            const currentList = await this.kv.get<OpenWorldConflictGamesList>('wc_games:open') || {
                games: [],
                lastUpdated: Date.now()
            };

            const gameInfo = {
                gameId: game.gameId,
                status: game.status,
                createdAt: game.createdAt,
                playerCount: game.players.length,
                maxPlayers: 4,
                gameType: game.gameType // Use the gameType from the game record instead of hardcoding
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
            console.error(`Error adding game ${game.gameId} to open games list:`, error);
        }
    }

    private async removeFromOpenGamesList(gameId: string): Promise<void> {
        try {
            const currentList = await this.kv.get<OpenWorldConflictGamesList>('wc_games:open');
            if (!currentList) return;

            currentList.games = currentList.games.filter(g => g.gameId !== gameId);
            currentList.lastUpdated = Date.now();

            await this.kv.put('wc_games:open', currentList);
        } catch (error) {
            console.error(`Error removing game ${gameId} from open games list:`, error);
        }
    }

    private generateGameId(): string {
        return Math.random().toString(36).substring(2, 10);
    }

    async deleteGame(gameId: string): Promise<void> {
        try {
            const game = await this.getGame(gameId);
            if (!game) return;

            // Remove player mappings
            for (const player of game.players) {
                await this.kv.delete(`wc_player:${player.index}:game`);
            }

            await this.kv.delete(`wc_game:${gameId}`);
            await this.removeFromOpenGamesList(gameId);
        } catch (error) {
            console.error(`Error deleting World Conflict game ${gameId}:`, error);
            throw error;
        }
    }

    async getGamesByStatus(status: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<WorldConflictGameRecord[]> {
        try {
            if (status === 'PENDING') {
                // For PENDING games, use the existing getOpenGames method which already filters for PENDING status
                return await this.getOpenGames();
            }

            // For other statuses, we need to implement a broader search
            // This is a simplified implementation - you might want to optimize this based on your storage strategy
            const openGamesList = await this.kv.get<OpenWorldConflictGamesList>('wc_games:open');
            if (!openGamesList) return [];

            const matchingGames: WorldConflictGameRecord[] = [];

            for (const gameInfo of openGamesList.games) {
                const fullGame = await this.getGame(gameInfo.gameId);
                if (fullGame && fullGame.status === status) {
                    matchingGames.push(fullGame);
                }
            }

            return matchingGames;
        } catch (error) {
            console.error(`Error getting World Conflict games with status ${status}:`, error);
            return [];
        }
    }
}
