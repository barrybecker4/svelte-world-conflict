/**
 * GameStorage - Persistence layer for Galactic Conflict games
 */

import type { GalacticGameStateData, Player, PendingGameConfiguration } from '$lib/game/entities/gameTypes';
import { KVStorage } from './KVStorage';
import { logger } from 'multiplayer-framework/shared';

const GAME_KEY_PREFIX = 'gc_game:';
const OPEN_GAMES_KEY = 'gc_open_games';

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

    constructor(platform: App.Platform) {
        this.storage = new KVStorage(platform);
    }

    static create(platform: App.Platform): GameStorage {
        return new GameStorage(platform);
    }

    /**
     * Save a game record
     */
    async saveGame(game: GameRecord): Promise<void> {
        const key = `${GAME_KEY_PREFIX}${game.gameId}`;
        game.lastUpdateAt = Date.now();
        await this.storage.put(key, game);
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
    }

    /**
     * List all games (with optional status filter)
     */
    async listGames(status?: 'PENDING' | 'ACTIVE' | 'COMPLETED'): Promise<GameRecord[]> {
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
     */
    async getOpenGames(): Promise<GameRecord[]> {
        const pendingGames = await this.listGames('PENDING');
        
        // Filter to games that have open slots
        return pendingGames.filter(game => {
            if (!game.pendingConfiguration?.playerSlots) return false;
            return game.pendingConfiguration.playerSlots.some(slot => slot.type === 'Open');
        });
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

