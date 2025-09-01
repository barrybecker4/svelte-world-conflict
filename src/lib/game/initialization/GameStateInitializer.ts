import { assignHomeBaseRegions, createOwnerAssignments } from '$lib/game/map/homeBasePlacement';
import type { Player, Region, GameStateData } from '$lib/game/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { validateRegionInstances } from '$lib/game/utils/regionUtils';

interface Assignment {
  playerIndex: number;
  regionIndex: number;
}

export class GameStateInitializer {
    /**
     * Create initial game state data with starting positions
     * Returns the data object, not the GameState instance
     */
    createInitialStateData(gameId: string, players: Player[], regions: Region[]): GameStateData {
        return this.createInitializedGameStateData(gameId, players, regions);
    }

    /**
     * Create preview state data for map configuration
     * Similar to createInitialStateData but designed for previews
     */
    createPreviewStateData(players: Player[], regions: Region[]): GameStateData {
        const stateData = this.createInitializedGameStateData('preview', players, regions);

        // Set preview-specific values
        stateData.turnIndex = 1;
        stateData.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;

        return stateData;
    }

    private createInitializedGameStateData(gameId: string, players: Player[], regions: Region[]): GameStateData {

      console.log(`Creating preview state with ${regions.length} regions`);
      if (!validateRegionInstances(regions)) {
          throw new Error('Invalid regions provided for preview');
      }

      const stateData = this.createGameStateData(gameId, players, regions);
      this.initializeStartingPositions(stateData);

      players.forEach(player => {
          stateData.faithByPlayer[player.index] = GAME_CONSTANTS.STARTING_FAITH;
      });
      return stateData;
    }

    private createGameStateData(gameId: string, players: Player[], regions: Region[]): GameStateData {
        return {
            id: Date.now(),
            gameId,
            turnIndex: 0,
            playerIndex: 0,
            movesRemaining: GAME_CONSTANTS.MAX_MOVES_PER_TURN,
            players: [...players],
            regions: regions, // Keep as Region instances for now
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

    private setupPlayerHomes(stateData: GameStateData, assignments: Assignment[]): void {
        assignments.forEach(assignment => {
            stateData.ownersByRegion[assignment.regionIndex] = assignment.playerIndex;

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
    private setupNeutralTemples(stateData: GameStateData, assignments: Assignment[]): void {

      const assignedRegionIndices = new Set(assignments.map(a => a.regionIndex));

      stateData.regions.forEach((region, index) => {
          // Skip regions that are already assigned as home bases
          if (assignedRegionIndices.has(index)) {
              return;
          }

          // Add temple to neutral temple regions
          if (region.hasTemple) {
              stateData.templesByRegion[index] = {
                  regionIndex: index,
                  level: 0
              };

              stateData.soldiersByRegion[index] =
                  this.createSoldiers(index, GAME_CONSTANTS.NEUTRAL_STARTING_SOLDIERS);
          }
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