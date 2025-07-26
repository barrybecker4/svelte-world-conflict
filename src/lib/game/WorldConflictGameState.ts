import { UPGRADES } from '$lib/game/constants/upgradeDefinitions.js';

/**
 * World Conflict Game State - Consolidated Implementation
 * This replaces both GameState.ts and WorldConflictGameState.ts
 */
export interface Player {
    id?: string; // Optional for compatibility
    index: number;
    name: string;
    color: string;
    isAI: boolean;
    aiLevel?: number;
    isEliminated?: boolean;
}

export interface Region {
    index: number;
    name: string;
    neighbors: number[];
    x: number;
    y: number;
    hasTemple: boolean;
}

export interface Temple {
    regionIndex: number;
    level: number;
    upgradeIndex?: number;
    maxLevel?: number;
}

export interface Soldier {
    i: number; // unique id
}

export interface FloatingText {
    regionIdx: number;
    text: string;
    color: string;
    width: number;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ==================== SINGLE CONSOLIDATED STATE INTERFACE ====================
// This replaces both GameStateData AND WorldConflictGameStateData

export interface WorldConflictGameStateData {
    // Core game state
    turnIndex: number;
    playerIndex: number;
    movesRemaining: number;

    // Game world state
    owners: Record<number, number>; // regionIndex -> playerIndex
    temples: Record<number, Temple>; // regionIndex -> Temple
    soldiersByRegion: Record<number, Soldier[]>; // regionIndex -> soldiers
    cash: Record<number, number>; // playerIndex -> cash amount

    // Optional state
    simulatingPlayer?: Player;
    floatingText?: FloatingText[];
    numBoughtSoldiers?: number;
    conqueredRegions?: number[];
    endResult?: Player | 'DRAWN_GAME' | null;

    // Metadata
    id: number;
    gameId: string;

    // Game references
    players: Player[];
    regions: Region[];
}

// Alias for backward compatibility
export type GameStateData = WorldConflictGameStateData;

// ==================== CLEAN GAME STATE CLASS ====================
// No more confusing inheritance - just composition

export class WorldConflictGameState {
    private state: WorldConflictGameStateData;

    constructor(data: WorldConflictGameStateData) {
        this.state = { ...data };

        // Ensure arrays are properly initialized
        if (!this.state.players) this.state.players = [];
        if (!this.state.regions) this.state.regions = [];
        if (!this.state.owners) this.state.owners = {};
        if (!this.state.temples) this.state.temples = {};
        if (!this.state.soldiersByRegion) this.state.soldiersByRegion = {};
        if (!this.state.cash) this.state.cash = {};
    }

    // ==================== FACTORY METHODS ====================

    static createInitialState(gameId: string, players: Player[], regions: Region[]): WorldConflictGameState {
        const initialState: WorldConflictGameStateData = {
            turnIndex: 1,
            playerIndex: 0,
            movesRemaining: 3,
            owners: {},
            temples: {},
            soldiersByRegion: {},
            cash: {},
            id: 1,
            gameId,
            players: [...players],
            regions: [...regions]
        };

        // Initialize starting positions and resources
        const gameState = new WorldConflictGameState(initialState);
        gameState.initializeStartingPositions();

        return gameState;
    }

    static fromJSON(data: WorldConflictGameStateData): WorldConflictGameState {
        return new WorldConflictGameState(data);
    }

    // Backward compatibility - same as fromJSON
    static fromGameStateData(data: WorldConflictGameStateData): WorldConflictGameState {
        return new WorldConflictGameState(data);
    }

    // ==================== ACCESSORS ====================

    get turnIndex(): number { return this.state.turnIndex; }
    get playerIndex(): number { return this.state.playerIndex; }
    get movesRemaining(): number { return this.state.movesRemaining; }
    get gameId(): string { return this.state.gameId; }
    get id(): number { return this.state.id; }
    get players(): Player[] { return [...this.state.players]; }
    get regions(): Region[] { return [...this.state.regions]; }
    get endResult(): Player | 'DRAWN_GAME' | null | undefined { return this.state.endResult; }
    get owners(): Record<number, number> { return { ...this.state.owners }; }
    get temples(): Record<number, Temple> { return { ...this.state.temples }; }
    get soldiersByRegion(): Record<number, Soldier[]> { return { ...this.state.soldiersByRegion }; }
    get cash(): Record<number, number> { return { ...this.state.cash }; }
    get floatingText(): FloatingText[] | undefined { return this.state.floatingText ? [...this.state.floatingText] : undefined; }
    get conqueredRegions(): number[] | undefined { return this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined; }
    get simulatingPlayer(): Player | undefined { return this.state.simulatingPlayer; }
    get numBoughtSoldiers(): number | undefined { return this.state.numBoughtSoldiers; }
    set numBoughtSoldiers(value: number | undefined) { this.state.numBoughtSoldiers = value; }

    set turnIndex(value: number) { this.state.turnIndex = value; }
    set playerIndex(value: number) { this.state.playerIndex = value; }
    set movesRemaining(value: number) { this.state.movesRemaining = value; }
    set endResult(value: Player | 'DRAWN_GAME' | null | undefined) { this.state.endResult = value; }
    set floatingText(value: FloatingText[] | undefined) { this.state.floatingText = value; }
    set conqueredRegions(value: number[] | undefined) { this.state.conqueredRegions = value; }

    // ==================== GAME LOGIC METHODS ====================

    owner(regionIndex: number): Player | null {
        const playerIndex = this.state.owners[regionIndex];
        return playerIndex !== undefined ? this.state.players[playerIndex] : null;
    }

    isOwnedBy(regionIndex: number, player: Player): boolean {
        return this.state.owners[regionIndex] === player.index;
    }

    soldierCount(regionIndex: number): number {
        return this.state.soldiersByRegion[regionIndex]?.length || 0;
    }

    soldiersAtRegion(regionIndex: number): Soldier[] {
        if (!this.state.soldiersByRegion[regionIndex]) {
            this.state.soldiersByRegion[regionIndex] = [];
        }
        return this.state.soldiersByRegion[regionIndex];
    }

    regionCount(player: Player): number {
        return Object.values(this.state.owners).filter(ownerIndex => ownerIndex === player.index).length;
    }

    cashFor(player: Player): number {
        return this.state.cash[player.index] || 0;
    }

    activePlayer(): Player {
        return this.state.players[this.state.playerIndex];
    }

    canPlayerMove(player: Player): boolean {
        return this.state.playerIndex === player.index && this.state.movesRemaining > 0;
    }

    canMoveFrom(regionIndex: number, player: Player): boolean {
        return (
            this.state.movesRemaining > 0 &&
            this.isOwnedBy(regionIndex, player) &&
            this.soldierCount(regionIndex) > 0 &&
            !(this.state.conqueredRegions?.includes(regionIndex))
        );
    }

    getRegion(index: number): Region | undefined {
        return this.state.regions.find(r => r.index === index);
    }

    getPlayer(index: number): Player | undefined {
        return this.state.players.find(p => p.index === index);
    }

    getPlayerById(id: string): Player | undefined {
        return this.state.players.find(p => p.id === id);
    }

    /**
     * Get the current upgrade level for specified player and upgrade type
     * @param player - The player to check upgrades for (null for neutral forces)
     * @param upgradeTypeName - The upgrade type name (e.g., 'DEFENSE', 'FIRE', 'WATER', etc.)
     * @returns The maximum upgrade level for that type, or 0 if none found
     */
    upgradeLevel(player: Player | null, upgradeTypeName: string): number {
        if (!player) {
            // neutral forces always have upgrade level 0
            return 0;
        }

        // Map upgrade type names to upgrade definitions
        const upgradeTypeMap: Record<string, any> = {
            'DEFENSE': UPGRADES.EARTH,
            'FIRE': UPGRADES.FIRE,
            'WATER': UPGRADES.WATER,
            'AIR': UPGRADES.AIR,
            'EARTH': UPGRADES.EARTH,
            'SOLDIER': UPGRADES.SOLDIER,
            'REBUILD': UPGRADES.REBUILD
        };

        const upgradeType = upgradeTypeMap[upgradeTypeName];
        if (!upgradeType) {
            console.warn(`Unknown upgrade type: ${upgradeTypeName}`);
            return 0;
        }

        let maxLevel = 0;

        // Check all regions for temples owned by this player
        for (const region of this.state.regions) {
            const temple = this.state.temples[region.index];

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

    /**
     * Get the raw upgrade level (temple level + 1) for specified player and upgrade type
     * This is used for checking upgrade prerequisites
     */
    rawUpgradeLevel(player: Player | null, upgradeTypeName: string): number {
        if (!player) {
            return 0;
        }

        const upgradeTypeMap: Record<string, any> = {
            'DEFENSE': UPGRADES.EARTH,
            'FIRE': UPGRADES.FIRE,
            'WATER': UPGRADES.WATER,
            'AIR': UPGRADES.AIR,
            'EARTH': UPGRADES.EARTH,
            'SOLDIER': UPGRADES.SOLDIER,
            'REBUILD': UPGRADES.REBUILD
        };

        const upgradeType = upgradeTypeMap[upgradeTypeName];
        if (!upgradeType) {
            return 0;
        }

        let maxLevel = 0;

        // Get all temples for this player
        for (const region of this.state.regions) {
            const temple = this.state.temples[region.index];

            if (temple && this.isOwnedBy(region.index, player)) {
                if (temple.upgradeIndex &&
                    temple.upgradeIndex === upgradeType.index) {
                    const level = (temple.level || 0) + 1;
                    maxLevel = Math.max(maxLevel, level);
                }
            }
        }

        return maxLevel;
    }

    /**
     * Get players array (for compatibility with existing code)
     */
    getPlayers(): Player[] {
        return this.players;
    }

    /**
     * Get regions array (for compatibility with existing code)
     */
    getRegions(): Region[] {
        return this.regions;
    }

    // ==================== STATE MUTATIONS ====================

    setOwner(regionIndex: number, player: Player): void {
        this.state.owners[regionIndex] = player.index;
    }

    addCash(player: Player, amount: number): void {
        this.state.cash[player.index] = (this.state.cash[player.index] || 0) + amount;
    }

    spendCash(player: Player, amount: number): boolean {
        const currentCash = this.state.cash[player.index] || 0;
        if (currentCash >= amount) {
            this.state.cash[player.index] = currentCash - amount;
            return true;
        }
        return false;
    }

    decrementMoves(): void {
        this.state.movesRemaining = Math.max(0, this.state.movesRemaining - 1);
    }

    addSoldiers(regionIndex: number, count: number): void {
        const soldiers = this.soldiersAtRegion(regionIndex);
        for (let i = 0; i < count; i++) {
            const soldierId = Math.floor(Math.random() * 1000000000000000);
            soldiers.push({ i: soldierId });
        }
    }

    removeSoldiers(regionIndex: number, count: number): Soldier[] {
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
        this.state.movesRemaining = 3; // Reset moves for new player
        this.state.turnIndex++;
        this.state.conqueredRegions = []; // Reset conquered regions for new turn
    }

    addFloatingText(text: FloatingText): void {
        if (!this.state.floatingText) this.state.floatingText = [];
        this.state.floatingText.push(text);
    }

    clearFloatingText(): void {
        this.state.floatingText = [];
    }

    // ==================== INITIALIZATION ====================

    private initializeStartingPositions(): void {
        console.log('🎮 Initializing game starting positions...');

        // Initialize cash for all players
        this.state.players.forEach((player, playerIndex) => {
            this.state.cash[player.index] = 100;
        });

        // IMPORTANT: Clear any existing soldiers - start fresh
        this.state.soldiersByRegion = {};

        // First, set up ALL temple regions (both neutral and player-owned)
        this.state.regions.forEach(region => {
            if (region.hasTemple) {
                // Add temple structure
                this.state.temples[region.index] = {
                    regionIndex: region.index,
                    level: 0
                };

                // Add exactly 3 soldiers to ALL temple regions
                this.addSoldiers(region.index, 3);
            }
        });

        // Find all temple regions for player assignment
        const templeRegions = this.state.regions.filter(region => region.hasTemple);

        if (templeRegions.length < this.state.players.length) {
            console.warn(`⚠️  Not enough temple regions (${templeRegions.length}) for all players (${this.state.players.length})`);
        }

        // Assign ONE home region to each player (must be a temple region)
        const assignedRegions: number[] = [];

        this.state.players.forEach((player, playerIndex) => {
            if (playerIndex < templeRegions.length) {
                let homeRegion: Region | null = null;

                if (assignedRegions.length === 0) {
                    // First player gets any temple region
                    homeRegion = templeRegions[0];
                } else {
                    // Subsequent players get temple regions that are furthest from already assigned ones
                    let maxDistance = 0;
                    let bestRegion: Region | null = null;

                    for (const candidateRegion of templeRegions) {
                        if (assignedRegions.includes(candidateRegion.index)) continue;

                        let minDistanceToAssigned = Infinity;
                        for (const assignedIndex of assignedRegions) {
                            const assignedRegion = this.state.regions[assignedIndex];
                            const distance = Math.sqrt(
                                Math.pow(candidateRegion.x - assignedRegion.x, 2) +
                                Math.pow(candidateRegion.y - assignedRegion.y, 2)
                            );
                            minDistanceToAssigned = Math.min(minDistanceToAssigned, distance);
                        }

                        if (minDistanceToAssigned > maxDistance) {
                            maxDistance = minDistanceToAssigned;
                            bestRegion = candidateRegion;
                        }
                    }

                    homeRegion = bestRegion || templeRegions.find(r => !assignedRegions.includes(r.index)) || null;
                }

                if (homeRegion) {
                    // Assign ownership of the home region to this player
                    this.state.owners[homeRegion.index] = player.index;
                    assignedRegions.push(homeRegion.index);

                    console.log(`✅ Player ${player.index} (${player.name}) assigned home region ${homeRegion.index} (${homeRegion.name}) with temple`);
                } else {
                    console.warn(`❌ Could not assign home region to player ${player.index} (${player.name})`);
                }
            } else {
                console.warn(`❌ Not enough temple regions for player ${player.index} (${player.name})`);
            }
        });

        // Validation logging
        console.log('🏁 Game initialization complete:');
        console.log(`   📍 Players with home regions: ${Object.keys(this.state.owners).length}`);
        console.log(`   🏛️  Total temple regions: ${Object.keys(this.state.temples).length}`);
        console.log(`   👑 Player-owned temples: ${Object.entries(this.state.owners).filter(([regionIndex]) =>
            this.state.temples[parseInt(regionIndex)]
        ).length}`);

        // Log army distribution for debugging
        const armyDistribution: {[key: number]: number} = {};
        Object.entries(this.state.soldiersByRegion).forEach(([regionIndex, soldiers]) => {
            const count = soldiers.length;
            armyDistribution[count] = (armyDistribution[count] || 0) + 1;
        });
        console.log('   ⚔️  Army distribution:', armyDistribution);

        // Ensure no non-temple regions have armies
        this.state.regions.forEach(region => {
            if (!region.hasTemple) {
                const armyCount = this.soldiersAtRegion(region.index).length;
                if (armyCount > 0) {
                    console.error(`❌ ERROR: Non-temple region ${region.index} (${region.name}) has ${armyCount} armies!`);
                }
            }
        });
    }

    // ==================== GAME END CHECKING ====================

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

    toJSON(): WorldConflictGameStateData {
        return { ...this.state };
    }

    // Backward compatibility
    toGameStateData(): WorldConflictGameStateData {
        return this.toJSON();
    }

    copy(): WorldConflictGameState {
        return new WorldConflictGameState({
            ...this.state,
            owners: { ...this.state.owners },
            temples: JSON.parse(JSON.stringify(this.state.temples)),
            soldiersByRegion: JSON.parse(JSON.stringify(this.state.soldiersByRegion)),
            cash: { ...this.state.cash },
            players: [...this.state.players],
            regions: [...this.state.regions],
            floatingText: this.state.floatingText ? [...this.state.floatingText] : undefined,
            conqueredRegions: this.state.conqueredRegions ? [...this.state.conqueredRegions] : undefined,
            id: this.state.id + 1
        });
    }

    // ==================== VALIDATION ====================

    validate(): ValidationResult {
        const errors: string[] = [];

        // Validate moves remaining
        if (this.state.movesRemaining < 0) {
            errors.push('Moves remaining cannot be negative');
        }

        // Validate player index
        if (this.state.playerIndex >= this.state.players.length) {
            errors.push('Player index out of bounds');
        }

        // Validate owners reference valid players
        for (const [regionIdx, playerIdx] of Object.entries(this.state.owners)) {
            if (playerIdx >= this.state.players.length) {
                errors.push(`Region ${regionIdx} owned by invalid player ${playerIdx}`);
            }
        }

        // Validate temples exist in owned regions
        for (const temple of Object.values(this.state.temples)) {
            if (this.state.owners[temple.regionIndex] === undefined) {
                errors.push(`Temple at region ${temple.regionIndex} has no owner`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
