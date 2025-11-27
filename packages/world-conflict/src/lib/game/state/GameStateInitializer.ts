import { assignHomeBaseRegions, type HomeBaseAssignment } from '$lib/game/map/homeBasePlacement';
import type { Player, Region, GameStateData } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import { generateSoldierId } from '$lib/game/utils/soldierIdGenerator';
import { AiDifficulty } from '$lib/game/entities/aiPersonalities';
import { logger } from '$lib/game/utils/logger';


export class GameStateInitializer {
    /**
     * Create initial game state data with starting positions
     * Returns the data object, not the GameState instance
     *
     * Note: Accepts Region[] (not Regions) because GameStateData must be JSON-serializable.
     * Use Regions.getAll() to convert from Regions to Region[] before calling this.
     */
    createInitialStateData(gameId: string, players: Player[], regions: Region[], maxTurns?: number, moveTimeLimit?: number, aiDifficulty?: string, seed?: string): GameStateData {
        return this.createInitializedGameStateData(gameId, players, regions, maxTurns, moveTimeLimit, aiDifficulty, seed);
    }

    /**
     * Create preview state data for map configuration
     * Similar to createInitialStateData but designed for previews
     */
    createPreviewStateData(players: Player[], regions: Region[]): GameStateData {
        const stateData = this.createInitializedGameStateData('preview', players, regions);

        // Set preview-specific values
        stateData.turnNumber = 1;
        stateData.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;

        return stateData;
    }

    private createInitializedGameStateData(gameId: string, players: Player[], regions: Region[], maxTurns?: number, moveTimeLimit?: number, aiDifficulty?: string, seed?: string): GameStateData {
        logger.debug(`Creating preview state with ${regions.length} regions`);

        const stateData = this.createGameStateData(gameId, players, regions, maxTurns, moveTimeLimit, aiDifficulty, seed);
        this.initializeStartingPositions(stateData);

        players.forEach(player => {
            stateData.faithByPlayer[player.slotIndex] = GAME_CONSTANTS.STARTING_FAITH;
        });
        return stateData;
    }

    private createGameStateData(gameId: string, players: Player[], regions: Region[], maxTurns?: number, moveTimeLimit?: number, aiDifficulty?: string, seed?: string): GameStateData {
        const sortedPlayers = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
        const sortedPlayerIndices = sortedPlayers.map(p => p.slotIndex);
        const currentPlayerSlot = sortedPlayerIndices[0];

        // Generate seed if not provided - use gameId and timestamp for uniqueness
        const rngSeed = seed || `${gameId}-${Date.now()}`;

        logger.debug(`Creating game with sorted players:`, sortedPlayers.map(p => `${p.name}(${p.slotIndex})`));
        logger.debug(`Setting initial currentPlayerSlot to ${currentPlayerSlot}`);
        logger.debug(`Setting moveTimeLimit to ${moveTimeLimit}`);
        logger.debug(`Setting aiDifficulty to ${aiDifficulty}`);
        logger.debug(`Setting RNG seed to ${rngSeed}`);

        return {
            id: Date.now(),
            gameId,
            turnNumber: 0,
            currentPlayerSlot,
            movesRemaining: GAME_CONSTANTS.MAX_MOVES_PER_TURN,
            maxTurns: maxTurns || GAME_CONSTANTS.MAX_TURN_OPTIONS[GAME_CONSTANTS.DEFAULT_TURN_COUNT_INDEX],
            moveTimeLimit: moveTimeLimit || GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT,
            aiDifficulty: aiDifficulty || AiDifficulty.RUDE,
            players: sortedPlayers, // Use sorted players array, not original unsorted array
            regions,
            ownersByRegion: {},
            templesByRegion: {},
            soldiersByRegion: {},
            faithByPlayer: {},
            floatingText: [],
            conqueredRegions: [],
            rngSeed
        };
    }

    /**
     * Initialize starting positions, temples, and soldiers for a new game.
     */
    private initializeStartingPositions(stateData: GameStateData): void {
        logger.debug('Assigning home base regions...');

        try {
            const assignments = assignHomeBaseRegions(stateData.players, stateData.regions);
            logger.debug(`Assigned ${assignments.length} home bases`);

            this.setupPlayerHomes(stateData, assignments);
            this.setupNeutralTemples(stateData, assignments);

        } catch (error) {
            logger.error('Failed to assign home bases:', error);
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
        const soldiers: { i: number }[] = [];
        for (let s = 0; s < numSoldiers; s++) {
            soldiers.push({ i: generateSoldierId() });
        }
        return soldiers;
    }
}
