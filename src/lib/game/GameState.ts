import type { Player, Region, Temple, Upgrade } from './types';

export interface GameStateData {
    turnIndex: number;
    playerIndex: number;
    movesRemaining: number;
    owners: Record<number, number>; // regionIndex -> playerIndex
    temples: Record<number, Temple>; // regionIndex -> Temple
    soldiersByRegion: Record<number, { i: number }[]>; // regionIndex -> soldiers array
    cash: Record<number, number>; // playerIndex -> cash amount (faith)
    simulatingPlayer?: Player;
    floatingText?: FloatingText[];
    numBoughtSoldiers?: number;
    conqueredRegions?: number[];
    id: number;
    gameId: string;
    endResult?: Player | 'DRAWN_GAME' | null;
}

export interface FloatingText {
    regionIdx: number;
    text: string;
    color: string;
    width: number;
}

export interface GameValidationResult {
    valid: boolean;
    errors: string[];
}

export class GameState {
    public turnIndex: number;
    public playerIndex: number;
    public movesRemaining: number;
    public owners: Record<number, number>;
    public temples: Record<number, Temple>;
    public soldiersByRegion: Record<number, { i: number }[]>;
    public cash: Record<number, number>;
    public simulatingPlayer?: Player;
    public floatingText?: FloatingText[];
    public numBoughtSoldiers?: number;
    public conqueredRegions?: number[];
    public id: number;
    public gameId: string;
    public endResult?: Player | 'DRAWN_GAME' | null;

    // Constants - these would typically come from a game data manager
    private static readonly BASE_MOVES_PER_TURN = 3;
    private static readonly MAX_TEMPLE_LEVEL = 3;

    constructor(data: GameStateData) {
        this.turnIndex = data.turnIndex;
        this.playerIndex = data.playerIndex;
        this.movesRemaining = data.movesRemaining;
        this.owners = data.owners || {};
        this.temples = data.temples || {};
        this.soldiersByRegion = data.soldiersByRegion || {};
        this.cash = data.cash || {};
        this.simulatingPlayer = data.simulatingPlayer;
        this.floatingText = data.floatingText;
        this.numBoughtSoldiers = data.numBoughtSoldiers;
        this.conqueredRegions = data.conqueredRegions;
        this.id = data.id || 1;
        this.gameId = data.gameId;
        this.endResult = data.endResult;
    }

    // ==================== PLAYER MANAGEMENT ====================

    /**
     * Get the currently active player
     */
    activePlayer(players: Player[]): Player {
        return players[this.playerIndex];
    }

    /**
     * Get the next player index in turn order
     */
    getNextPlayerIndex(players: Player[]): number {
        let nextIndex = (this.playerIndex + 1) % players.length;

        // Skip eliminated players
        while (this.isPlayerEliminated(players[nextIndex]) && nextIndex !== this.playerIndex) {
            nextIndex = (nextIndex + 1) % players.length;
        }

        return nextIndex;
    }

    /**
     * Get the next player in turn order
     */
    getNextPlayer(players: Player[]): Player {
        return players[this.getNextPlayerIndex(players)];
    }

    /**
     * Advance to the next player's turn
     */
    advanceToNextPlayer(players: Player[], upgradeLevel?: (player: Player, upgradeType: string) => number): Player {
        const nextPlayerIndex = this.getNextPlayerIndex(players);
        const upcomingPlayer = players[nextPlayerIndex];

        // Calculate turn number (increment when we cycle back to player 0)
        const turnNumber = this.turnIndex + (nextPlayerIndex === 0 ? 1 : 0);

        // Calculate number of moves (base + air upgrade level)
        const airUpgradeLevel = upgradeLevel ? upgradeLevel(upcomingPlayer, 'AIR') : 0;
        const numMoves = GameState.BASE_MOVES_PER_TURN + airUpgradeLevel;

        this.turnIndex = turnNumber;
        this.playerIndex = nextPlayerIndex;
        this.movesRemaining = numMoves;
        this.conqueredRegions = undefined;
        this.numBoughtSoldiers = undefined;

        return upcomingPlayer;
    }

    /**
     * Check if a player is eliminated
     */
    isPlayerEliminated(player: Player | number): boolean {
        const playerIndex = typeof player === 'number' ? player : player.index;
        return this.regionCount(playerIndex) === 0;
    }

    // ==================== REGION MANAGEMENT ====================

    /**
     * Get the owner of a region
     */
    owner(regionIndex: number, players: Player[]): Player | null {
        const ownerIndex = this.owners[regionIndex];
        return ownerIndex !== undefined ? players[ownerIndex] : null;
    }

    /**
     * Check if a region is owned by a specific player
     */
    isOwnedBy(regionIndex: number, player: Player): boolean {
        const ownerIndex = this.owners[regionIndex];
        return ownerIndex !== undefined && ownerIndex === player.index;
    }

    /**
     * Get the number of regions owned by a player
     */
    regionCount(player: Player | number): number {
        const playerIndex = typeof player === 'number' ? player : player.index;
        return Object.values(this.owners).filter(ownerIndex => ownerIndex === playerIndex).length;
    }

    /**
     * Set the owner of a region
     */
    setOwner(regionIndex: number, player: Player | null): void {
        if (player) {
            this.owners[regionIndex] = player.index;
        } else {
            delete this.owners[regionIndex];
        }
    }

    // ==================== ARMY MANAGEMENT ====================

    /**
     * Get the number of soldiers in a region
     */
    soldierCount(regionIndex: number): number {
        return this.soldiersAtRegion(regionIndex).length;
    }

    /**
     * Get the soldiers array for a region
     */
    soldiersAtRegion(regionIndex: number): { i: number }[] {
        return this.soldiersByRegion[regionIndex] || (this.soldiersByRegion[regionIndex] = []);
    }

    /**
     * Add soldiers to a region
     */
    addSoldiers(regionIndex: number, count: number): void {
        const soldierList = this.soldiersAtRegion(regionIndex);
        for (let i = 0; i < count; i++) {
            const soldierId = Math.floor(Math.random() * 1000000000000000);
            soldierList.push({ i: soldierId });
        }
    }

    /**
     * Remove soldiers from a region
     */
    removeSoldiers(regionIndex: number, count: number): { i: number }[] {
        const soldierList = this.soldiersAtRegion(regionIndex);
        const removed = soldierList.splice(0, count);

        // Clean up empty arrays
        if (soldierList.length === 0) {
            delete this.soldiersByRegion[regionIndex];
        }

        return removed;
    }

    /**
     * Transfer soldiers between regions
     */
    transferSoldiers(fromRegion: number, toRegion: number, count: number): void {
        const soldiers = this.removeSoldiers(fromRegion, count);
        this.soldiersAtRegion(toRegion).push(...soldiers);
    }

    /**
     * Get total soldiers for a player
     */
    totalSoldiers(player: Player, regions: Region[]): number {
        return regions.reduce((total, region) => {
            return total + (this.isOwnedBy(region.index, player) ? this.soldierCount(region.index) : 0);
        }, 0);
    }

    // ==================== TEMPLE MANAGEMENT ====================

    /**
     * Get temple for a region
     */
    templeForRegion(regionIndex: number): Temple | null {
        return this.temples[regionIndex] || null;
    }

    /**
     * Get all temples owned by a player
     */
    templesForPlayer(player: Player): Temple[] {
        return Object.values(this.temples).filter(temple =>
            this.isOwnedBy(temple.regionIndex, player)
        );
    }

    /**
     * Add or update a temple
     */
    setTemple(regionIndex: number, temple: Temple): void {
        this.temples[regionIndex] = temple;
    }

    /**
     * Remove a temple
     */
    removeTemple(regionIndex: number): void {
        delete this.temples[regionIndex];
    }

    // ==================== MOVE VALIDATION ====================

    /**
     * Check if a player can move from a region
     */
    canMoveFrom(regionIndex: number, player: Player): boolean {
        return (this.movesRemaining > 0) &&
            this.isOwnedBy(regionIndex, player) &&
            this.soldierCount(regionIndex) > 0 &&
            !(this.conqueredRegions && this.conqueredRegions.includes(regionIndex));
    }

    /**
     * Check if a move is valid between two regions
     */
    canMoveTo(fromRegion: number, toRegion: number, player: Player, regions: Region[]): boolean {
        if (!this.canMoveFrom(fromRegion, player)) {
            return false;
        }

        // Check if regions are adjacent
        const sourceRegion = regions.find(r => r.index === fromRegion);
        if (!sourceRegion || !sourceRegion.neighbors.includes(toRegion)) {
            return false;
        }

        return true;
    }

    // ==================== RESOURCE MANAGEMENT ====================

    /**
     * Get cash (faith) for a player
     */
    cashForPlayer(player: Player): number {
        return this.cash[player.index] || 0;
    }

    /**
     * Add cash to a player
     */
    addCash(player: Player, amount: number): void {
        this.cash[player.index] = (this.cash[player.index] || 0) + amount;
    }

    /**
     * Remove cash from a player
     */
    removeCash(player: Player, amount: number): boolean {
        const currentCash = this.cash[player.index] || 0;
        if (currentCash >= amount) {
            this.cash[player.index] = currentCash - amount;
            return true;
        }
        return false;
    }

    // ==================== GAME STATE MANAGEMENT ====================

    /**
     * Create a deep copy of the game state
     */
    copy(simulatingPlayer?: Player): GameState {
        return new GameState({
            turnIndex: this.turnIndex,
            playerIndex: this.playerIndex,
            movesRemaining: this.movesRemaining,
            owners: { ...this.owners },
            temples: this.deepCopyTemples(),
            soldiersByRegion: this.deepCopySoldiers(),
            cash: { ...this.cash },
            simulatingPlayer: this.simulatingPlayer || simulatingPlayer,
            floatingText: this.floatingText ? [...this.floatingText] : undefined,
            numBoughtSoldiers: this.numBoughtSoldiers,
            conqueredRegions: this.conqueredRegions ? [...this.conqueredRegions] : undefined,
            id: this.id + 1,
            gameId: this.gameId,
            endResult: this.endResult
        });
    }

    /**
     * Deep copy temples object
     */
    private deepCopyTemples(): Record<number, Temple> {
        const copied: Record<number, Temple> = {};
        for (const [key, temple] of Object.entries(this.temples)) {
            copied[parseInt(key)] = { ...temple };
        }
        return copied;
    }

    /**
     * Deep copy soldiers object
     */
    private deepCopySoldiers(): Record<number, { i: number }[]> {
        const copied: Record<number, { i: number }[]> = {};
        for (const [key, soldiers] of Object.entries(this.soldiersByRegion)) {
            copied[parseInt(key)] = soldiers.map(soldier => ({ ...soldier }));
        }
        return copied;
    }

    /**
     * Validate the current game state
     */
    validate(players: Player[], regions: Region[]): GameValidationResult {
        const errors: string[] = [];

        // Validate player index
        if (this.playerIndex < 0 || this.playerIndex >= players.length) {
            errors.push(`Invalid player index: ${this.playerIndex}`);
        }

        // Validate region ownership
        for (const [regionIndex, ownerIndex] of Object.entries(this.owners)) {
            const regionIdx = parseInt(regionIndex);
            if (regionIdx < 0 || regionIdx >= regions.length) {
                errors.push(`Invalid region index in owners: ${regionIdx}`);
            }
            if (ownerIndex < 0 || ownerIndex >= players.length) {
                errors.push(`Invalid owner index for region ${regionIdx}: ${ownerIndex}`);
            }
        }

        // Validate soldier counts
        for (const [regionIndex, soldiers] of Object.entries(this.soldiersByRegion)) {
            const regionIdx = parseInt(regionIndex);
            if (regionIdx < 0 || regionIdx >= regions.length) {
                errors.push(`Invalid region index in soldiers: ${regionIdx}`);
            }
            if (!Array.isArray(soldiers)) {
                errors.push(`Invalid soldiers array for region ${regionIdx}`);
            }
        }

        // Validate temple ownership
        for (const temple of Object.values(this.temples)) {
            if (this.owners[temple.regionIndex] === undefined) {
                errors.push(`Temple at region ${temple.regionIndex} has no owner`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Serialize to JSON
     */
    toJSON(): GameStateData {
        return {
            turnIndex: this.turnIndex,
            playerIndex: this.playerIndex,
            movesRemaining: this.movesRemaining,
            owners: this.owners,
            temples: this.temples,
            soldiersByRegion: this.soldiersByRegion,
            cash: this.cash,
            simulatingPlayer: this.simulatingPlayer,
            floatingText: this.floatingText,
            numBoughtSoldiers: this.numBoughtSoldiers,
            conqueredRegions: this.conqueredRegions,
            id: this.id,
            gameId: this.gameId,
            endResult: this.endResult
        };
    }

    /**
     * Create from JSON
     */
    static fromJSON(data: GameStateData): GameState {
        return new GameState(data);
    }
}
