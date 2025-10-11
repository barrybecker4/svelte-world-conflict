import type { Player, Region, GameStateData, Soldier } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { TEMPLE_UPGRADES, TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';
import { GameStateInitializer } from '$lib/game/state/GameStateInitializer';
import { GameStateValidator, MoveValidator, TempleValidator } from '$lib/game/validation';
import type { ValidationResult, MoveValidationResult } from '$lib/game/validation/validation';
import { Regions } from '$lib/game/entities/Regions';

// Re-export types for convenience
export type { Player, Region, GameStateData, Soldier };

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
    static createInitialState(gameId: string, players: Player[], regionData: any[], maxTurns?: number): GameState {
        console.log(`🎮 Creating initial game state for ${gameId} with maxTurns: ${maxTurns}`);

        let regions: Region[];

        // Use Regions class for validation/processing, then extract to plain array
        // GameStateData must use Region[] (not Regions) for proper JSON serialization
        regions = (regionData?.length > 0)
            ? Regions.fromJSON(regionData).getAll()
            : Regions.createBasic(Math.max(players.length * 3, 12)).getAll();

        console.log(`Using ${regions.length} regions for game initialization`);

        const initializer = new GameStateInitializer();
        const initialStateData = initializer.createInitialStateData(gameId, players, regions, maxTurns);

        return new GameState(initialStateData);
    }

    /**
     * Create from JSON data
     */
    static fromJSON(data: GameStateData | any): GameState {
        return new GameState(data);
    }

    validate(): ValidationResult {
        return GameStateValidator.validate(this.state);
    }

    validateMove(fromRegion: number, toRegion: number, soldierCount: number): MoveValidationResult {
        return MoveValidator.validateMove(this.state, fromRegion, toRegion, soldierCount);
    }

    validateTempleOperation(regionIndex: number, operationType: 'build' | 'upgrade'): MoveValidationResult {
        return TempleValidator.validateTempleOperation(this.state, regionIndex, operationType);
    }

    // ==================== ACCESSORS ====================

    get turnNumber(): number { return this.state.turnNumber; }
    set turnNumber(value: number) { this.state.turnNumber = value; }

    get currentPlayerSlot(): number { return this.state.currentPlayerSlot; }
    set currentPlayerSlot(value: number) { this.state.currentPlayerSlot = value; }

    get numBoughtSoldiers(): number { return (this.state as any).numBoughtSoldiers || 0; }
    set numBoughtSoldiers(value: number) { (this.state as any).numBoughtSoldiers = value; }

    get conqueredRegions(): number[] { return this.state.conqueredRegions || []; }
    set conqueredRegions(value: number[]) { this.state.conqueredRegions = value; }

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

    get maxTurns(): number { return this.state.maxTurns || GAME_CONSTANTS.MAX_GAME_TURNS; }
    get moveTimeLimit(): number | undefined { return this.state.moveTimeLimit; }

    get endResult(): Player | 'DRAWN_GAME' | null | undefined { return this.state.endResult; }
    set endResult(value: Player | 'DRAWN_GAME' | null | undefined) { this.state.endResult = value; }

    // ==================== PLAYER MANAGEMENT ====================

    getCurrentPlayer(): Player | undefined {
        return this.state.players.find(p => p.slotIndex === this.state.currentPlayerSlot);
    }

    getPlayerBySlotIndex(slotIndex: number): Player | undefined {
        return this.state.players.find(p => p.slotIndex === slotIndex);
    }

    // ==================== REGION OWNERSHIP ====================

    getRegionOwner(regionIndex: number): number | undefined {
        return this.state.ownersByRegion[regionIndex];
    }

    setRegionOwner(regionIndex: number, playerSlotIndex: number): void {
        this.state.ownersByRegion[regionIndex] = playerSlotIndex;
    }

    clearRegionOwner(regionIndex: number): void {
        delete this.state.ownersByRegion[regionIndex];
    }

    isRegionOwnedByPlayer(regionIndex: number, playerSlotIndex: number): boolean {
        return this.state.ownersByRegion[regionIndex] === playerSlotIndex;
    }

    // Alias for backward compatibility with commands
    isOwnedBy(regionIndex: number, player: Player): boolean {
        return this.isRegionOwnedByPlayer(regionIndex, player.slotIndex);
    }

    // Alias for backward compatibility with commands
    owner(regionIndex: number): number | undefined {
        return this.getRegionOwner(regionIndex);
    }

    /**
     * Get all regions owned by a specific player
     */
    getRegionsOwnedByPlayer(playerSlotIndex: number): Region[] {
        return this.state.regions.filter(region => 
            this.state.ownersByRegion[region.index] === playerSlotIndex
        );
    }

    // ==================== SOLDIER MANAGEMENT ====================

    getSoldiersInRegion(regionIndex: number): any[] {
        // Ensure the array exists in the state so modifications persist
        if (!this.state.soldiersByRegion[regionIndex]) {
            this.state.soldiersByRegion[regionIndex] = [];
        }
        return this.state.soldiersByRegion[regionIndex];
    }

    // Alias for backward compatibility with commands
    soldiersAtRegion(regionIndex: number): any[] {
        return this.getSoldiersInRegion(regionIndex);
    }

    // Alias for backward compatibility with commands - returns count of soldiers
    soldierCount(regionIndex: number): number {
        return this.getSoldiersInRegion(regionIndex).length;
    }

    setSoldiersInRegion(regionIndex: number, soldiers: any[]): void {
        this.state.soldiersByRegion[regionIndex] = soldiers;
    }

    addSoldiersToRegion(regionIndex: number, count: number): void {
        if (!this.state.soldiersByRegion[regionIndex]) {
            this.state.soldiersByRegion[regionIndex] = [];
        }

        for (let i = 0; i < count; i++) {
            this.state.soldiersByRegion[regionIndex].push({ i: Date.now() + i });
        }
    }

    removeSoldiersFromRegion(regionIndex: number, count: number): any[] {
        const soldiers = this.state.soldiersByRegion[regionIndex] || [];
        const removed = soldiers.splice(0, Math.min(count, soldiers.length));
        return removed;
    }

    // ==================== TEMPLE MANAGEMENT ====================

    getTemple(regionIndex: number): any | undefined {
        return this.state.templesByRegion[regionIndex];
    }

    hasTemple(regionIndex: number): boolean {
        return regionIndex in this.state.templesByRegion;
    }

    setTemple(regionIndex: number, temple: any): void {
        this.state.templesByRegion[regionIndex] = temple;
    }

    upgradeTemple(regionIndex: number): boolean {
        const temple = this.state.templesByRegion[regionIndex];
        if (!temple) return false;

        if (temple.level < GAME_CONSTANTS.MAX_TEMPLE_LEVEL) {
            temple.level++;
            return true;
        }

        return false;
    }

    // Get number of temples for a specific upgrade type
    getTempleUpgradeCount(upgradeType: any): number {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return 0;

        return Object.values(this.state.templesByRegion).filter(temple => {
            const regionIndex = temple.regionIndex;
            const owner = this.state.ownersByRegion[regionIndex];

            if (owner !== currentPlayer.slotIndex) return false;

            // Check if this temple has the right type of upgrade
            if (temple.upgradeIndex &&
                temple.upgradeIndex === upgradeType.index) {
                return true;
            }

            return false;
        }).length;
    }

    // ==================== FAITH MANAGEMENT ====================

    getPlayerFaith(playerSlotIndex: number): number {
        return this.state.faithByPlayer[playerSlotIndex] || 0;
    }

    setPlayerFaith(playerSlotIndex: number, amount: number): void {
        this.state.faithByPlayer[playerSlotIndex] = Math.max(0, amount);
    }

    addPlayerFaith(playerSlotIndex: number, amount: number): void {
        const current = this.getPlayerFaith(playerSlotIndex);
        this.setPlayerFaith(playerSlotIndex, current + amount);
    }

    subtractPlayerFaith(playerSlotIndex: number, amount: number): boolean {
        const current = this.getPlayerFaith(playerSlotIndex);
        if (current >= amount) {
            this.setPlayerFaith(playerSlotIndex, current - amount);
            return true;
        }
        return false;
    }

    // ==================== TURN MANAGEMENT ====================

    advanceTurn(): void {
        this.state.turnNumber++;
        this.state.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;
    }

    resetMovesRemaining(): void {
        this.state.movesRemaining = GAME_CONSTANTS.MAX_MOVES_PER_TURN;
    }

    // ==================== GAME END CONDITIONS ====================

    isGameComplete(): boolean {
        return this.state.endResult !== null && this.state.endResult !== undefined;
    }

    determineWinner(): Player | 'DRAWN_GAME' | null {
        // Find all active players (those who still own regions)
        const activePlayers = this.state.players.filter(player =>
            Object.values(this.state.ownersByRegion).includes(player.slotIndex)
        );

        if (activePlayers.length === 1) {
            this.state.endResult = activePlayers[0];
            return activePlayers[0];
        }

        // Check turn limit
        if (activePlayers.length === 0) {
            this.state.endResult = 'DRAWN_GAME';
            return 'DRAWN_GAME';
        }

        return null;
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Count how many regions a player owns
     */
    regionCount(player: Player): number {
        return Object.values(this.state.ownersByRegion).filter(
            owner => owner === player.slotIndex
        ).length;
    }

    /**
     * Get the upgrade level for a specific upgrade type owned by a player
     * Used for calculating upgrade bonuses (e.g., EARTH defense)
     */
    upgradeLevel(playerSlotIndex: number | undefined, upgradeName: string): number {
        if (playerSlotIndex === undefined) return 0;

        // Map upgrade names to their effects
        const upgradeMap: Record<string, string> = {
            'DEFENSE': 'EARTH',
            'EARTH': 'EARTH'
        };

        const targetUpgradeName = upgradeMap[upgradeName] || upgradeName;

        // Find all temples owned by this player with the specified upgrade
        let maxLevel = 0;
        for (const [regionIndex, temple] of Object.entries(this.state.templesByRegion)) {
            const regionIdx = parseInt(regionIndex);
            if (this.state.ownersByRegion[regionIdx] === playerSlotIndex && temple) {
                // Check if temple has the upgrade
                if (temple.upgradeIndex !== undefined) {
                    const upgradeKeys = Object.keys(TEMPLE_UPGRADES);
                    const upgrade = upgradeKeys[temple.upgradeIndex];
                    
                    if (upgrade === targetUpgradeName && temple.level) {
                        maxLevel = Math.max(maxLevel, temple.level);
                    }
                }
            }
        }

        return maxLevel;
    }

    /**
     * Add soldiers to a region (alias for backward compatibility)
     */
    addSoldiers(regionIndex: number, count: number): void {
        this.addSoldiersToRegion(regionIndex, count);
    }

    /**
     * Set the owner of a region (alias for backward compatibility)
     */
    setOwner(regionIndex: number, player: Player): void {
        this.setRegionOwner(regionIndex, player.slotIndex);
    }

    /**
     * Create a copy of the game state (alias for clone)
     */
    copy(): GameState {
        return this.clone();
    }

    /**
     * Create a clean copy of the game state data suitable for JSON serialization
     */
    toJSON(): any {
        return {
            ...this.state,
            players: [...this.state.players],
            regions: [...this.state.regions],
            floatingText: this.state.floatingText ? [...this.state.floatingText] : undefined,
            conqueredRegions: this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined
        };
    }

    /**
     * Create a deep clone of this game state
     */
    clone(): GameState {
        return new GameState(this.toJSON());
    }
}
