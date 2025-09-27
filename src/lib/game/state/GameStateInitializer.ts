import { assignHomeBaseRegions, type HomeBaseAssignment } from '$lib/game/map/homeBasePlacement';
import type { Player, Region, GameStateData } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { Regions } from '$lib/game/entities/Regions';


export class GameStateInitializer {
    /**
     * Create initial game state data with starting positions
     * Returns the data object, not the GameState instance
     */
    createInitialStateData(gameId: string, players: Player[], regions: Regions, maxTurns?: number): GameStateData {
        return this.createInitializedGameStateData(gameId, players, regions, maxTurns);
    }

    /**
     * Create preview state data for map configuration
     * Similar to createInitialStateData but designed for previews
     */
    createPreviewStateData(players: Player[], regions: Regions): GameStateData {
        const stateData = this.createInitializedGameStateData('preview', players, regions);

        // Set preview-specific values
        stateData.turnNumber = 1;
        stateData.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;

        return stateData;
    }

    private createInitializedGameStateData(gameId: string, players: Player[], regions: Regions, maxTurns?: number): GameStateData {
        console.log(`Creating preview state with ${regions.length} regions`);

        const stateData = this.createGameStateData(gameId, players, regions, maxTurns);
        this.initializeStartingPositions(stateData);

        players.forEach(player => {
            stateData.faithByPlayer[player.slotIndex] = GAME_CONSTANTS.STARTING_FAITH;
        });
        return stateData;
    }

    private createGameStateData(gameId: string, players: Player[], regions: Region[], maxTurns?: number): GameStateData {
        const sortedPlayers = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
        const sortedPlayerIndices = sortedPlayers.map(p => p.slotIndex);
        const currentPlayerSlot = sortedPlayerIndices[0];

        console.log(`Creating game with sorted players:`, sortedPlayers.map(p => `${p.name}(${p.slotIndex})`));
        console.log(`Setting initial currentPlayerSlot to ${currentPlayerSlot}`);

        return {
            id: Date.now(),
            gameId,
            turnNumber: 0,
            currentPlayerSlot,
            movesRemaining: GAME_CONSTANTS.MAX_MOVES_PER_TURN,
            maxTurns: maxTurns || GAME_CONSTANTS.STANDARD_TURN_COUNT,
            players: [...players],
            regions,
            ownersByRegion: {},
            templesByRegion: {},
            soldiersByRegion: {},
            faithByPlayer: {},
            floatingText: [],
            conqueredRegions: []
        };
    }

    /**
     * Initialize starting positions, temples, and soldiers for a new game.
     */
    private initializeStartingPositions(stateData: GameStateData): void {
        console.log('Assigning home base regions...');

        try {
            const assignments = assignHomeBaseRegions(stateData.players, stateData.regions);
            console.log(`Assigned ${assignments.length} home bases`);

            this.setupPlayerHomes(stateData, assignments);
            this.setupNeutralTemples(stateData, assignments);

        } catch (error) {
            console.error('Failed to assign home bases:', error);
        }
    }

    private setupPlayerHomes(stateData: GameStateData, assignments: HomeBaseAssignment[]): void {
        assignments.forEach(assignment => {
            stateData.ownersByRegion[assignment.regionIndex] = assignment.playerSlotIndex;

            // Add initial soldiers
            stateData.soldiersByRegion[assignment.regionIndex] =
                this.createSoldiers(assignment.regionIndex, GAME_CONSTANTS.OWNER_STARTING_SOLDIERS);

            // Add temple if the region has one
            if (assignment.region.hasTemple) {
                stateData.templesByRegion[assignment.regionIndex] = {
                    regionIndex: assignment.regionIndex,
                    level: 0
                };
            }
        });
    }

    // Add neutral temples to all remaining temple regions
    private setupNeutralTemples(stateData: GameStateData, assignments: HomeBaseAssignment[]): void {
        const assignedRegionIndices = new Set(assignments.map(a => a.regionIndex));

        // Get all temple regions that aren't already assigned as home bases
        const neutralTempleRegions = stateData.regions.filter(region =>
            region.hasTemple && !assignedRegionIndices.has(region.index)
        );

        neutralTempleRegions.forEach(region => {
            stateData.templesByRegion[region.index] = {
                regionIndex: region.index,
                level: 0
            };

            stateData.soldiersByRegion[region.index] =
                this.createSoldiers(region.index, GAME_CONSTANTS.NEUTRAL_STARTING_SOLDIERS);
        });
    }

    private createSoldiers(index: number, numSoldiers: number): { i: number }[] {
        const soldiers = [];
        for (let s = 0; s < numSoldiers; s++) {
            soldiers.push({ i: index * 10 + s + 1 });
        }
        return soldiers;
    }
}