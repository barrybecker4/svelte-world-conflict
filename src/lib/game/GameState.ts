import type { Player, Region, GameStateData } from '$lib/game/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { UPGRADES, UPGRADES_BY_NAME } from '$lib/game/constants/upgradeDefinitions';
import { GameStateInitializer } from './initialization/GameStateInitializer';
import { GameStateValidator, MoveValidator, TempleValidator } from './validation';
import type { ValidationResult, MoveValidationResult } from './types/validation';
import { createBasicRegions, reconstructRegionsFromJSON, validateRegionInstances } from './utils/regionUtils';

export class GameState {
    public state: GameStateData;

    constructor(data: GameStateData) {
        this.state = { ...data };

        // Initialize default values if missing
        if (!this.state.players) this.state.players = [];
        if (!this.state.regions) this.state.regions = [];
        if (!this.state.ownersByRegion) this.state.ownersByRegion = {};
        if (!this.state.templesByRegion) this.state.templesByRegion = {};
        if (!this.state.soldiersByRegion) this.state.soldiersByRegion = {};
        if (!this.state.faithByPlayer) this.state.faithByPlayer = {};
        if (!this.state.conqueredRegions) this.state.conqueredRegions = [];
    }

    /**
     * Create initial game state - uses GameStateInitializer to prepare data
     */
    static createInitialState(gameId: string, players: Player[], regionData: any[]): GameState {
      console.log(`🎮 Creating initial game state for ${gameId}`);
      console.log(`Players: ${players.length}, Region data provided: ${regionData?.length || 0}`);

      let regions: Region[];

      if (regionData && regionData.length > 0) {
          console.log('Reconstructing regions from provided data...');
          regions = reconstructRegionsFromJSON(regionData);

          if (!validateRegionInstances(regions)) {
              console.error('❌ Region reconstruction failed, falling back to basic regions');
              regions = createBasicRegions(Math.max(players.length * 3, 12));
          }
      } else {
          console.log('No region data provided, generating basic regions...');
          regions = createBasicRegions(Math.max(players.length * 3, 12));
      }

      console.log(`Using ${regions.length} regions for game initialization`);

      // Verify the first region has the getDistanceTo method
      if (regions[0] && typeof regions[0].getDistanceTo === 'function') {
          console.log('Region methods verified - ready for home base assignment');
      } else {
          console.error(' Regions missing methods - home base assignment will fail!');
          throw new Error('Region reconstruction failed - regions missing required methods');
      }

      const initializer = new GameStateInitializer();
      const initialStateData = initializer.createInitialStateData(gameId, players, regions);

      return new GameState(initialStateData);
    }

    /**
     * Create from JSON data - handles both new and legacy formats
     */
    static fromJSON(data: GameStateData | any): GameState {
        // If it looks like legacy data, convert it
        if (data.owners || data.temples || data.faith) {
            const convertedData = GameStateInitializer.convertLegacyData(data);
            return new GameState(convertedData);
        }

        return new GameState(data);
    }

    /**
     * Validate this game state's integrity
     */
    validate(): ValidationResult {
        return GameStateValidator.validate(this.state);
    }

    /**
     * Validate a move operation
     */
    validateMove(fromRegion: number, toRegion: number, soldierCount: number): MoveValidationResult {
        return MoveValidator.validateMove(this.state, fromRegion, toRegion, soldierCount);
    }

    /**
     * Validate temple operations
     */
    validateTempleOperation(regionIndex: number, operationType: 'build' | 'upgrade'): MoveValidationResult {
        return TempleValidator.validateTempleOperation(this.state, regionIndex, operationType);
    }

    // ==================== ACCESSORS ====================

    get turnIndex(): number { return this.state.turnIndex; }
    set turnIndex(value: number) { this.state.turnIndex = value; }

    get playerIndex(): number { return this.state.playerIndex; }
    set playerIndex(value: number) { this.state.playerIndex = value; }

    get movesRemaining(): number { return this.state.movesRemaining; }
    set movesRemaining(value: number) { this.state.movesRemaining = value; }

    get gameId(): string { return this.state.gameId; }
    get id(): number { return this.state.id; }
    get players(): Player[] { return [...this.state.players]; }
    get regions(): Region[] { return [...this.state.regions]; }
    get ownersByRegion(): Record<number, number> { return { ...this.state.ownersByRegion }; }
    get templesByRegion(): Record<number, any> { return { ...this.state.templesByRegion }; }
    get soldiersByRegion(): Record<number, any[]> { return { ...this.state.soldiersByRegion }; }
    get faithByPlayer(): Record<number, number> { return { ...this.state.faithByPlayer }; }
    get floatingText(): any[] | undefined { return this.state.floatingText ? [...this.state.floatingText] : undefined; }

    get conqueredRegions(): number[] | undefined { return this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined; }
    set conqueredRegions(value: number[] | undefined) { this.state.conqueredRegions = value; }

    get endResult(): Player | 'DRAWN_GAME' | null | undefined { return this.state.endResult; }
    set endResult(value: Player | 'DRAWN_GAME' | null | undefined) { this.state.endResult = value; }

    // ==================== GAME OPERATIONS ====================

    getCurrentPlayer(): Player {
        return this.state.players[this.state.playerIndex];
    }

    activePlayer(): Player {
        return this.state.players[this.state.playerIndex];
    }

    getPlayer(index: number): Player | undefined {
        return this.state.players.find(p => p.index === index);
    }

    getPlayerById(id: string): Player | undefined {
        return this.state.players.find(p => p.id === id);
    }

    /**
     * Get all regions owned by a specific player
     */
    getRegionsOwnedByPlayer(playerIndex: number): Region[] {
        return this.state.regions.filter(region =>
            this.state.ownersByRegion[region.index] === playerIndex
        );
    }

    owner(regionIndex: number): Player | null {
        const ownerIndex = this.state.ownersByRegion[regionIndex];
        return ownerIndex !== undefined ? this.state.players[ownerIndex] : null;
    }

    isOwnedBy(regionIndex: number, player: Player): boolean {
        return this.state.ownersByRegion[regionIndex] === player.index;
    }

    soldiersAtRegion(regionIndex: number): any[] {
        if (!this.state.soldiersByRegion[regionIndex]) {
            this.state.soldiersByRegion[regionIndex] = [];
        }
        return this.state.soldiersByRegion[regionIndex];
    }

    soldierCount(regionIndex: number): number {
        return this.soldiersAtRegion(regionIndex).length;
    }

    regionCount(player: Player): number {
        return this.state.regions.filter(region =>
            this.state.ownersByRegion[region.index] === player.index
        ).length;
    }

    faith(playerIndex: number): number {
        return this.state.faithByPlayer[playerIndex] || 0;
    }

    setOwner(regionIndex: number, player: Player): void {
        this.state.ownersByRegion[regionIndex] = player.index;
    }

    addSoldiers(regionIndex: number, count: number): void {
        const soldiers = this.soldiersAtRegion(regionIndex);
        const nextSoldierId = Math.max(0, ...Object.values(this.state.soldiersByRegion)
            .flat().map((s: any) => s.i || 0)) + 1;

        for (let i = 0; i < count; i++) {
            soldiers.push({ i: nextSoldierId + i });
        }
    }

    canMoveFrom(regionIndex: number, player: Player): boolean {
        return (
            this.state.movesRemaining > 0 &&
            this.isOwnedBy(regionIndex, player) &&
            this.soldierCount(regionIndex) > 0 &&
            !(this.state.conqueredRegions?.includes(regionIndex))
        );
    }

    removeSoldiers(regionIndex: number, count: number): any[] {
        const soldiers = this.soldiersAtRegion(regionIndex);
        return soldiers.splice(0, Math.min(count, soldiers.length));
    }

    moveSoldiers(fromRegion: number, toRegion: number, count: number): boolean {
        const fromSoldiers = this.soldiersAtRegion(fromRegion);
        if (fromSoldiers.length < count) return false;

        const movedSoldiers = fromSoldiers.splice(0, count);
        const toSoldiers = this.soldiersAtRegion(toRegion);
        toSoldiers.push(...movedSoldiers);

        return true;
    }

    advanceToNextPlayer(): void {
        this.state.playerIndex = (this.state.playerIndex + 1) % this.state.players.length;
        this.state.movesRemaining = GAME_CONSTANTS.BASE_MOVES_PER_TURN;
        this.state.turnIndex++;
        this.state.conqueredRegions = [];
    }

    /**
     * Get the current upgrade level for specified player and upgrade type
     * @param player - The player to check upgrades for (null for neutral forces)
     * @param upgradeTypeName - The upgrade type name (e.g., 'DEFENSE', 'FIRE', 'WATER', etc.)
     * @returns The maximum upgrade level for that type, or 0 if none found
     */
    upgradeLevel(player: Player | null, upgradeTypeName: string): number {
        if (!player) {
            return 0;
        }

        const upgradeType = UPGRADES_BY_NAME[upgradeTypeName];
        if (!upgradeType) {
            console.warn(`Unknown upgrade type: ${upgradeTypeName}`);
            return 0;
        }

        let maxLevel = 0;

        // Check all regions for temples owned by this player
        for (const region of this.state.regions) {
            const temple = this.state.templesByRegion[region.index];

            if (temple && this.isOwnedBy(region.index, player)) {
                // Check if this temple has the right type of upgrade
                if (temple.upgradeIndex &&
                    temple.upgradeIndex === upgradeType.index) {

                    // Get the upgrade level value from the upgrade definition
                    const currentLevel = temple.level || 0;
                    if (currentLevel < upgradeType.level.length) {
                        const levelValue = upgradeType.level[currentLevel];
                        maxLevel = Math.max(maxLevel, levelValue);
                    }
                }
            }
        }

        return maxLevel;
    }

    addFloatingText(text: any): void {
        if (!this.state.floatingText) this.state.floatingText = [];
        this.state.floatingText.push(text);
    }

    clearFloatingText(): void {
        this.state.floatingText = [];
    }

    /**
     * Check if the game is complete (has an end result)
     */
    isGameComplete(): boolean {
        return this.state.endResult !== null && this.state.endResult !== undefined;
    }

    checkGameEnd(): Player | 'DRAWN_GAME' | null {
        const activePlayers = this.state.players.filter(player => this.regionCount(player) > 0);

        if (activePlayers.length === 1) {
            this.state.endResult = activePlayers[0];
            return activePlayers[0];
        }

        if (activePlayers.length === 0) {
            this.state.endResult = 'DRAWN_GAME';
            return 'DRAWN_GAME';
        }

        return null;
    }

    // ==================== SERIALIZATION ====================

    toJSON(): GameStateData {
        return { ...this.state };
    }

    toGameStateData(): GameStateData {
        return this.toJSON();
    }

    copy(): GameState {
        return new GameState({
            ...this.state,
            ownersByRegion: { ...this.state.ownersByRegion },
            templesByRegion: JSON.parse(JSON.stringify(this.state.templesByRegion)),
            soldiersByRegion: JSON.parse(JSON.stringify(this.state.soldiersByRegion)),
            faithByPlayer: { ...this.state.faithByPlayer },
            players: [...this.state.players],
            regions: [...this.state.regions],
            floatingText: this.state.floatingText ? [...this.state.floatingText] : undefined,
            conqueredRegions: this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined
        });
    }
}

// Export types for external use
export type { ValidationResult, MoveValidationResult };
