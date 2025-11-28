import type { Player, Region, GameStateData, Soldier, Temple } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from "$lib/game/constants/gameConstants";
import { TEMPLE_UPGRADES, TEMPLE_UPGRADES_BY_NAME } from '$lib/game/constants/templeUpgradeDefinitions';
import { GameStateInitializer } from '$lib/game/state/GameStateInitializer';
import { GameStateValidator, MoveValidator, TempleValidator } from '$lib/game/validation';
import type { ValidationResult, MoveValidationResult } from '$lib/game/validation/validation';
import { Regions } from '$lib/game/entities/Regions';
import { generateSoldierId } from '$lib/game/utils/soldierIdGenerator';
import { RandomNumberGenerator } from '$lib/game/utils/RandomNumberGenerator';
import { logger } from '$lib/game/utils/logger';

// Re-export types for convenience
export type { Player, Region, GameStateData, Soldier, Temple };

export class GameState {
    public state: GameStateData;
    public rng: RandomNumberGenerator;

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
        if (!this.state.eliminatedPlayers) this.state.eliminatedPlayers = [];

        // Initialize or restore RNG
        if (this.state.rngSeed && this.state.rngState) {
            // Restore from serialized state
            this.rng = new RandomNumberGenerator(this.state.rngSeed, this.state.rngState);
        } else if (this.state.rngSeed) {
            // Initialize from seed
            this.rng = new RandomNumberGenerator(this.state.rngSeed);
        } else {
            // Fallback: create with default seed (shouldn't happen in normal flow)
            this.state.rngSeed = `default-${Date.now()}`;
            this.rng = new RandomNumberGenerator(this.state.rngSeed);
        }
    }

    /**
     * Create initial game state - uses GameStateInitializer to prepare data
     */
    static createInitialState(gameId: string, players: Player[], regionData: any[], maxTurns?: number, moveTimeLimit?: number, aiDifficulty?: string, seed?: string): GameState {
        logger.debug(`🎮 Creating initial game state for ${gameId} with maxTurns: ${maxTurns}, moveTimeLimit: ${moveTimeLimit}, aiDifficulty: ${aiDifficulty}, seed: ${seed}`);

        let regions: Region[];

        // Use Regions class for validation/processing, then extract to plain array
        // GameStateData must use Region[] (not Regions) for proper JSON serialization
        regions = (regionData?.length > 0)
            ? Regions.fromJSON(regionData).getAll()
            : Regions.createBasic(Math.max(players.length * 3, 12), seed).getAll();

        logger.debug(`Using ${regions.length} regions for game initialization`);

        const initializer = new GameStateInitializer();
        const initialStateData = initializer.createInitialStateData(gameId, players, regions, maxTurns, moveTimeLimit, aiDifficulty, seed);

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
            this.state.soldiersByRegion[regionIndex].push({ i: generateSoldierId() });
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
                    const upgrade = TEMPLE_UPGRADES[temple.upgradeIndex];

                    if (upgrade && upgrade.name === targetUpgradeName && temple.level) {
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

    // ==================== AI HELPER METHODS ====================

    /**
     * Get the active player (whose turn it is)
     */
    activePlayer(): Player | undefined {
        return this.getCurrentPlayer();
    }

    /**
     * Count total soldiers owned by a player across all regions
     */
    totalSoldiers(player: Player): number {
        let total = 0;
        for (const [regionIndex, owner] of Object.entries(this.state.ownersByRegion)) {
            if (owner === player.slotIndex) {
                total += this.soldierCount(parseInt(regionIndex));
            }
        }
        return total;
    }

    /**
     * Get all temples owned by a player
     */
    templesForPlayer(player: Player): Temple[] {
        const temples: Temple[] = [];
        for (const [regionIndex, temple] of Object.entries(this.state.templesByRegion)) {
            const regionIdx = parseInt(regionIndex);
            if (this.state.ownersByRegion[regionIdx] === player.slotIndex && temple) {
                temples.push(temple);
            }
        }
        return temples;
    }

    /**
     * Calculate faith income per turn for a player
     * Based on temples owned and their upgrade bonuses
     */
    income(player: Player): number {
        let baseIncome = 0;
        let waterBonus = 0;

        const temples = this.templesForPlayer(player);

        // Each temple provides base income
        for (const temple of temples) {
            baseIncome += GAME_CONSTANTS.TEMPLE_INCOME_BASE;

            // Water upgrade increases income by percentage
            if (temple.upgradeIndex === TEMPLE_UPGRADES_BY_NAME.WATER.index && temple.level !== undefined) {
                const waterUpgrade = TEMPLE_UPGRADES_BY_NAME.WATER;
                const bonusPercent = waterUpgrade.level[temple.level] || 0;
                waterBonus += (GAME_CONSTANTS.TEMPLE_INCOME_BASE * bonusPercent) / 100;
            }
        }

        return Math.floor(baseIncome + waterBonus);
    }

    /**
     * Calculate the current cost to buy a soldier
     */
    soldierCost(): number {
        const numBought = this.state.numBoughtSoldiers || 0;
        const costArray = TEMPLE_UPGRADES_BY_NAME.SOLDIER.cost;
        // If we've exhausted the array, use formula: initialCost + numBought
        return costArray[numBought] ?? (8 + numBought);
    }

    /**
     * Check if a region has soldiers that can be moved by the player
     */
    regionHasActiveArmy(player: Player, region: Region): boolean {
        if (!this.isOwnedBy(region.index, player)) {
            return false;
        }
        return this.soldierCount(region.index) > 0;
    }

    /**
     * Get the raw upgrade level for a player's temple upgrade type
     * Used by AI to check what upgrades they have
     */
    rawUpgradeLevel(player: Player, upgrade: any): number {
        const temples = this.templesForPlayer(player);
        for (const temple of temples) {
            if (temple.upgradeIndex === upgrade.index) {
                return temple.level || 0;
            }
        }
        return 0;
    }

    /**
     * Create a clean copy of the game state data suitable for JSON serialization
     *
     * IMPORTANT: We deep copy templesByRegion and soldiersByRegion because commands
     * (like BuildCommand) mutate these nested objects. Without deep copying, the old
     * and new state would share the same temple/soldier object references, causing:
     * 1. Mutations to affect both states
     * 2. Svelte reactivity to fail (no reference change detected)
     * 3. UI not updating until page refresh
     */
    toJSON(): any {
        // Deep copy templesByRegion to avoid shared references
        const templesByRegionCopy: Record<number, any> = {};
        for (const [key, temple] of Object.entries(this.state.templesByRegion)) {
            templesByRegionCopy[Number(key)] = { ...temple };
        }

        // Deep copy soldiersByRegion to avoid shared references
        // Must deep copy individual soldier objects too, not just the array
        const soldiersByRegionCopy: Record<number, any[]> = {};
        for (const [key, soldiers] of Object.entries(this.state.soldiersByRegion)) {
            soldiersByRegionCopy[Number(key)] = soldiers ? soldiers.map(s => ({ ...s })) : [];
        }

        // Serialize RNG state
        const rngState = this.rng.getState();

        return {
            ...this.state,
            players: [...this.state.players],
            regions: [...this.state.regions],
            faithByPlayer: { ...this.state.faithByPlayer },
            ownersByRegion: { ...this.state.ownersByRegion },
            templesByRegion: templesByRegionCopy,
            soldiersByRegion: soldiersByRegionCopy,
            floatingText: this.state.floatingText ? [...this.state.floatingText] : undefined,
            conqueredRegions: this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined,
            eliminatedPlayers: this.state.eliminatedPlayers ? [...this.state.eliminatedPlayers] : undefined,
            rngSeed: rngState.seed,
            rngState: rngState.state
        };
    }

    /**
     * Create a deep clone of this game state
     */
    clone(): GameState {
        return new GameState(this.toJSON());
    }
}
