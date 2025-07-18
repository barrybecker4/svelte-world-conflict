import type { WorldConflictKVStorage } from './kv.ts';
import type { WorldConflictGameRecord } from './games.ts';
import type { Player } from '$lib/game/types.ts';

export interface WorldConflictGameHistoryEntry {
    gameId: string;
    completedAt: number;
    duration: number;
    playerCount: number;
    winner: Player | null;
    finalPlayers: Player[];
    gameType: 'MULTIPLAYER' | 'AI';
    endReason: 'ELIMINATION' | 'TURN_LIMIT' | 'RESIGNATION' | 'TIMEOUT';
}

export interface WorldConflictPlayerStats {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
    averageGameDuration: number;
    favoriteGameType: 'MULTIPLAYER' | 'AI';
}

export class WorldConflictHistoryStorage {
    private kv: WorldConflictKVStorage;

    constructor(kv: WorldConflictKVStorage) {
        this.kv = kv;
    }

    async addGameToHistory(game: WorldConflictGameRecord): Promise<void> {
        if (game.status !== 'COMPLETED') {
            return; // Only add completed games to history
        }

        try {
            const historyEntry: WorldConflictGameHistoryEntry = {
                gameId: game.gameId,
                completedAt: Date.now(),
                duration: Date.now() - game.createdAt,
                playerCount: game.players.length,
                winner: this.determineWinner(game),
                finalPlayers: game.players,
                gameType: 'MULTIPLAYER', // Could be determined from game data
                endReason: this.determineEndReason(game)
            };

            // Store the individual game history
            await this.kv.put(`wc_history:game:${game.gameId}`, historyEntry);

            // Update player statistics
            for (const player of historyEntry.finalPlayers) {
                await this.updatePlayerStats(player, historyEntry);
            }

        } catch (error) {
            console.error(`Error adding World Conflict game ${game.gameId} to history:`, error);
            throw error;
        }
    }

    async getGameHistory(gameId: string): Promise<WorldConflictGameHistoryEntry | null> {
        try {
            return await this.kv.get<WorldConflictGameHistoryEntry>(`wc_history:game:${gameId}`);
        } catch (error) {
            console.error(`Error getting World Conflict game history for ${gameId}:`, error);
            return null;
        }
    }

    async getPlayerStats(playerId: string): Promise<WorldConflictPlayerStats> {
        try {
            const stats = await this.kv.get<WorldConflictPlayerStats>(`wc_history:player:${playerId}`);
            if (!stats) {
                return {
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                    averageGameDuration: 0,
                    favoriteGameType: 'MULTIPLAYER'
                };
            }
            return stats;
        } catch (error) {
            console.error(`Error getting World Conflict player stats for ${playerId}:`, error);
            return {
                totalGames: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                averageGameDuration: 0,
                favoriteGameType: 'MULTIPLAYER'
            };
        }
    }

    async getRecentGames(limit: number = 10): Promise<WorldConflictGameHistoryEntry[]> {
        try {
            const historyKeys = await this.kv.list('wc_history:game:');
            const games: WorldConflictGameHistoryEntry[] = [];

            for (const key of historyKeys.keys.slice(0, limit)) {
                const game = await this.kv.get<WorldConflictGameHistoryEntry>(key.name);
                if (game) {
                    games.push(game);
                }
            }

            // Sort by completion time (most recent first)
            return games.sort((a, b) => b.completedAt - a.completedAt);
        } catch (error) {
            console.error('Error getting recent World Conflict games:', error);
            return [];
        }
    }

    private determineWinner(game: WorldConflictGameRecord): Player | null {
        // This depends on your game end conditions
        // For now, assume the winner is in the game's end result
        const endResult = game.worldConflictState.endResult;
        if (endResult && typeof endResult !== 'string') {
            return endResult.winner;
        }
        return null;
    }

    private determineEndReason(game: WorldConflictGameRecord): WorldConflictGameHistoryEntry['endReason'] {
        // This depends on how you track game end reasons
        // For now, default to elimination
        const endResult = game.worldConflictState.endResult;
        if (endResult) {
            switch (endResult.reason) {
                case 'ELIMINATION': return 'ELIMINATION';
                case 'TURN_LIMIT': return 'TURN_LIMIT';
                default: return 'ELIMINATION';
            }
        }
        return 'ELIMINATION';
    }

    private async updatePlayerStats(player: Player, historyEntry: WorldConflictGameHistoryEntry): Promise<void> {
        try {
            const currentStats = await this.getPlayerStats(player.id);

            const wasWinner = historyEntry.winner?.id === player.id;
            const totalDuration = currentStats.averageGameDuration * currentStats.totalGames + historyEntry.duration;

            const updatedStats: WorldConflictPlayerStats = {
                totalGames: currentStats.totalGames + 1,
                wins: currentStats.wins + (wasWinner ? 1 : 0),
                losses: currentStats.losses + (wasWinner ? 0 : 1),
                winRate: 0, // Will be calculated below
                averageGameDuration: totalDuration / (currentStats.totalGames + 1),
                favoriteGameType: historyEntry.gameType // Could be more sophisticated
            };

            // Calculate win rate
            updatedStats.winRate = updatedStats.totalGames > 0
                ? updatedStats.wins / updatedStats.totalGames
                : 0;

            await this.kv.put(`wc_history:player:${player.id}`, updatedStats);
        } catch (error) {
            console.error(`Error updating World Conflict player stats for ${player.id}:`, error);
            throw error;
        }
    }

    async deletePlayerHistory(playerId: string): Promise<void> {
        try {
            await this.kv.delete(`wc_history:player:${playerId}`);
        } catch (error) {
            console.error(`Error deleting World Conflict player history for ${playerId}:`, error);
            throw error;
        }
    }

    async deleteGameHistory(gameId: string): Promise<void> {
        try {
            await this.kv.delete(`wc_history:game:${gameId}`);
        } catch (error) {
            console.error(`Error deleting World Conflict game history for ${gameId}:`, error);
            throw error;
        }
    }
}
