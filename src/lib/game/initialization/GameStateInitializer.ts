import { assignHomeBaseRegions, createOwnerAssignments } from '$lib/game/map/homeBasePlacement';
import type { Player, Region, GameStateData } from '$lib/game/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";

export class GameStateInitializer {
    /**
     * Create initial game state data with starting positions
     * Returns the data object, not the GameState instance
     */
    static createInitialStateData(gameId: string, players: Player[], regions: Region[]): GameStateData {
        const initialData: GameStateData = {
            turnIndex: 1,
            playerIndex: 0,
            movesRemaining: 3,
            ownersByRegion: {},
            templesByRegion: {},
            soldiersByRegion: {},
            faithByPlayer: {},
            id: 1,
            gameId,
            players: [...players],
            regions: [...regions]
        };

        this.initializeStartingPositions(initialData);
        return initialData;
    }

    /**
     * Initialize starting positions, temples, and soldiers for a new game
     * Works directly with the data object
     */
    static initializeStartingPositions(gameData: GameStateData): void {
        console.log('🎮 Initializing game starting positions...');

        // Initialize faith for all players
        gameData.players.forEach((player) => {
            gameData.faithByPlayer[player.index] = GAME_CONSTANTS.DEFAULT_STARTING_FAITH;
        });

        // IMPORTANT: Clear any existing soldiers - start fresh
        gameData.soldiersByRegion = {};

        const homeBaseAssignments = assignHomeBaseRegions(gameData.players, gameData.regions);

        // Apply the assignments to game state
        const owners = createOwnerAssignments(homeBaseAssignments);
        gameData.ownersByRegion = { ...gameData.ownersByRegion, ...owners };

        // Set up ALL temple regions (both neutral and player-owned)
        gameData.regions.forEach(region => {
            if (region.hasTemple) {
                // Add temple structure
                gameData.templesByRegion[region.index] = {
                    regionIndex: region.index,
                    level: 0
                };

                // Add starting soldiers to ALL temple regions
                const startingSoldiers = region.index in gameData.ownersByRegion
                    ? GAME_CONSTANTS.OWNER_STARTING_SOLDIERS
                    : GAME_CONSTANTS.NEUTRAL_STARTING_SOLDIERS;

                this.addSoldiersToData(gameData, region.index, startingSoldiers);
            }
        });

        // Log the results
        homeBaseAssignments.forEach(assignment => {
            const player = gameData.players[assignment.playerIndex];
            console.log(`✅ Player ${player.index} (${player.name}) assigned home region ${assignment.regionIndex} (${assignment.region.name}) with temple`);
        });

        // Ensure the game has valid starting conditions
        if (homeBaseAssignments.length < gameData.players.length) {
            console.warn(`⚠️ Warning: Only ${homeBaseAssignments.length} out of ${gameData.players.length} players have home regions!`);
        }
    }

    /**
     * Add soldiers to a region in the data structure
     */
    private static addSoldiersToData(gameData: GameStateData, regionIndex: number, count: number): void {
        if (!gameData.soldiersByRegion[regionIndex]) {
            gameData.soldiersByRegion[regionIndex] = [];
        }

        const soldiers = gameData.soldiersByRegion[regionIndex];
        const nextSoldierId = Math.max(0, ...Object.values(gameData.soldiersByRegion)
            .flat().map((s: any) => s.i || 0)) + 1;

        for (let i = 0; i < count; i++) {
            soldiers.push({ i: nextSoldierId + i });
        }
    }

    /**
     * Convert legacy flat data to new structure
     * Returns the data object, not the GameState instance
     */
    static convertLegacyData(legacyData: any): GameStateData {
        return {
            id: legacyData.id || 1,
            gameId: legacyData.gameId || '',
            turnIndex: legacyData.turnIndex || 1,
            playerIndex: legacyData.playerIndex || 0,
            movesRemaining: legacyData.movesRemaining || 3,

            ownersByRegion: legacyData.owners || legacyData.ownersByRegion || {},
            templesByRegion: legacyData.temples || legacyData.templesByRegion || {},
            soldiersByRegion: legacyData.soldiersByRegion || {},
            faithByPlayer: legacyData.faith || legacyData.faithByPlayer || {},

            players: legacyData.players || [],
            regions: legacyData.regions || [],

            floatingText: legacyData.floatingText,
            conqueredRegions: legacyData.conqueredRegions,
            moveTimeLimit: legacyData.moveTimeLimit,
            maxTurns: legacyData.maxTurns,
            endResult: legacyData.endResult
        };
    }
}
