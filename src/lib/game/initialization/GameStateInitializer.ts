import { assignHomeBaseRegions, createOwnerAssignments } from '$lib/game/map/homeBasePlacement';
import type { Player, Region, GameStateData } from '$lib/game/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { validateRegionInstances } from '$lib/game/utils/regionUtils';

export class GameStateInitializer {
    /**
     * Create initial game state data with starting positions
     * Returns the data object, not the GameState instance
     */
    createInitialStateData(gameId: string, players: Player[], regions: Region[]): GameStateData {
        console.log(`Initializing game state with ${regions.length} regions`);

        // Validate regions before proceeding
        if (!validateRegionInstances(regions)) {
            throw new Error('Invalid regions provided to GameStateInitializer');
        }

        const stateData: GameStateData = {
            id: Date.now(),
            gameId,
            turnIndex: 0,
            playerIndex: 0,
            movesRemaining: 3,
            players: [...players],
            regions: regions, // Keep as Region instances for now
            ownersByRegion: {},
            templesByRegion: {},
            soldiersByRegion: {},
            faithByPlayer: {},
            floatingText: [],
            conqueredRegions: []
        };

        this.initializeStartingPositions(stateData);

        players.forEach(player => {
            stateData.faithByPlayer[player.index] = 100;
        });

        console.log(`Game state initialized successfully`);
        return stateData;
    }

    /**
     * Initialize starting positions, temples, and soldiers for a new game
     * Works directly with the data object
     */
    private initializeStartingPositions(stateData: GameStateData): void {
        console.log('Assigning home base regions...');

        try {
            // This should now work because regions are proper Region instances
            const assignments = assignHomeBaseRegions(stateData.players, stateData.regions);

            console.log(`Assigned ${assignments.length} home bases`);

            // Apply assignments
            assignments.forEach(assignment => {
                stateData.ownersByRegion[assignment.regionIndex] = assignment.playerIndex;

                // Add initial soldiers
                stateData.soldiersByRegion[assignment.regionIndex] = [
                    { i: assignment.regionIndex * 10 + 1 },
                    { i: assignment.regionIndex * 10 + 2 },
                    { i: assignment.regionIndex * 10 + 3 }
                ];

                // Add temple if the region has one
                if (assignment.region.hasTemple) {
                    stateData.templesByRegion[assignment.regionIndex] = {
                        regionIndex: assignment.regionIndex,
                        level: 0
                    };
                }
            });

        } catch (error) {
            console.error('Failed to assign home bases:', error);

            // Emergency fallback - assign first N regions to players
            stateData.players.forEach((player, index) => {
                if (index < stateData.regions.length) {
                    stateData.ownersByRegion[index] = player.index;
                    stateData.soldiersByRegion[index] = [
                        { i: index * 10 + 1 },
                        { i: index * 10 + 2 },
                        { i: index * 10 + 3 }
                    ];
                }
            });

            console.log('Used emergency fallback for home base assignment');
        }
    }
}
