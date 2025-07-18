import { GameState } from './GameState.ts';
import type { Player, Region, Temple } from './types.ts';

export interface FloatingText {
    regionIdx: number;
    text: string;
    color: string;
    width: number;
}

export interface WorldConflictGameStateData {
    // Base game state
    turnIndex: number;
    playerIndex: number;
    movesRemaining: number;

    // World Conflict specific
    owners: Record<number, number>; // regionIndex -> playerIndex
    temples: Record<number, Temple>; // regionIndex -> Temple
    soldiersByRegion: Record<number, Array<{ i: string }>>; // regionIndex -> soldiers
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

    // Game data references
    players: Player[];
    regions: Region[];
}

export class WorldConflictGameState extends GameState {
    public owners: Record<number, number>;
    public temples: Record<number, Temple>;
    public soldiersByRegion: Record<number, Array<{ i: string }>>;
    public cash: Record<number, number>;
    public simulatingPlayer?: Player;
    public floatingText?: FloatingText[];
    public numBoughtSoldiers?: number;
    public conqueredRegions?: number[];
    public endResult?: Player | 'DRAWN_GAME' | null;

    // Game data
    private players: Player[];
    private regions: Region[];

    constructor(data: WorldConflictGameStateData) {
        super({
            gameId: data.gameId,
            players: data.players.map(p => ({ id: p.id, name: p.name })),
            status: data.endResult ? 'COMPLETED' : 'ACTIVE',
            turnIndex: data.turnIndex,
            board: [], // Not used in World Conflict
            player1: data.players[0] ? { id: data.players[0].id, name: data.players[0].name } : { id: '', name: '' },
            player2: data.players[1] ? { id: data.players[1].id, name: data.players[1].name } : null,
            lastMoveAt: Date.now(),
            createdAt: Date.now()
        });

        this.owners = data.owners || {};
        this.temples = data.temples || {};
        this.soldiersByRegion = data.soldiersByRegion || {};
        this.cash = data.cash || {};
        this.simulatingPlayer = data.simulatingPlayer;
        this.floatingText = data.floatingText;
        this.numBoughtSoldiers = data.numBoughtSoldiers;
        this.conqueredRegions = data.conqueredRegions;
        this.endResult = data.endResult;

        this.players = data.players;
        this.regions = data.regions;

        this.playerIndex = data.playerIndex;
        this.movesRemaining = data.movesRemaining;
        this.id = data.id;
    }

    // ==================== WORLD CONFLICT SPECIFIC METHODS ====================

    /**
     * Get the owner of a region
     */
    owner(region: number | Region): Player | null {
        const idx = typeof region === 'number' ? region : region.index;
        const ownerIndex = this.owners[idx];
        return ownerIndex !== undefined ? this.players[ownerIndex] : null;
    }

    /**
     * Check if a region is owned by a player
     */
    isOwnedBy(region: number | Region, player: Player): boolean {
        const owner = this.owner(region);
        return owner !== null && owner.index === player.index;
    }

    /**
     * Get soldier count at a region
     */
    soldierCount(regionIndex: number): number {
        return this.soldiersAtRegion(regionIndex).length;
    }

    /**
     * Get soldiers array at a region
     */
    soldiersAtRegion(regionIndex: number): Array<{ i: string }> {
        if (!this.soldiersByRegion[regionIndex]) {
            this.soldiersByRegion[regionIndex] = [];
        }
        return this.soldiersByRegion[regionIndex];
    }

    /**
     * Add soldiers to a region
     */
    addSoldiers(regionIndex: number, count: number): void {
        const soldierList = this.soldiersAtRegion(regionIndex);
        for (let i = 0; i < count; i++) {
            const soldierId = Math.random().toString(36).substr(2, 9);
            soldierList.push({ i: soldierId });
        }
    }

    /**
     * Count regions owned by a player
     */
    regionCount(player: Player): number {
        return this.regions.filter(region => this.isOwnedBy(region, player)).length;
    }

    /**
     * Get all temples owned by a player
     */
    templesForPlayer(player: Player): Temple[] {
        const playerTemples: Temple[] = [];
        for (const [regionIndex, temple] of Object.entries(this.temples)) {
            if (this.isOwnedBy(parseInt(regionIndex), player)) {
                playerTemples.push(temple);
            }
        }
        return playerTemples;
    }

    /**
     * Get temple at a specific region
     */
    templeForRegion(region: number | Region): Temple | null {
        const regionIdx = typeof region === 'number' ? region : region.index;
        return this.temples[regionIdx] || null;
    }

    /**
     * Get total soldiers for a player
     */
    totalSoldiers(player: Player): number {
        return this.regions
            .filter(region => this.isOwnedBy(region, player))
            .reduce((total, region) => total + this.soldierCount(region.index), 0);
    }

    /**
     * Get cash for a player
     */
    cashForPlayer(player: Player): number {
        return this.cash[player.index] || 0;
    }

    /**
     * Get upgrade level for a player and upgrade type
     */
    upgradeLevel(player: Player | null, upgradeType: string): number {
        if (!player) return 0;

        const temples = this.templesForPlayer(player);
        return Math.max(
            0,
            ...temples
                .filter(temple => temple.upgradeIndex !== undefined)
                .map(temple => {
                    const upgrade = this.getUpgradeByIndex(temple.upgradeIndex!);
                    return upgrade?.name === upgradeType ? temple.level + 1 : 0;
                })
        );
    }

    /**
     * Check if a region can be source for army move
     */
    canMoveFrom(region: number | Region, player: Player): boolean {
        const regionIdx = typeof region === 'number' ? region : region.index;

        return (
            this.movesRemaining > 0 &&
            this.isOwnedBy(regionIdx, player) &&
            this.soldierCount(regionIdx) > 0 &&
            !(this.conqueredRegions?.includes(regionIdx))
        );
    }

    /**
     * Check if the game has ended
     */
    checkGameEnd(): Player | 'DRAWN_GAME' | null {
        const activePlayers = this.players.filter(player => this.regionCount(player) > 0);

        if (activePlayers.length === 1) {
            return activePlayers[0];
        }

        if (activePlayers.length === 0) {
            return 'DRAWN_GAME';
        }

        return null;
    }

    /**
     * Copy this game state
     */
    copy(): WorldConflictGameState {
        return new WorldConflictGameState({
            turnIndex: this.turnIndex,
            playerIndex: this.playerIndex,
            movesRemaining: this.movesRemaining,
            owners: { ...this.owners },
            temples: JSON.parse(JSON.stringify(this.temples)),
            soldiersByRegion: JSON.parse(JSON.stringify(this.soldiersByRegion)),
            cash: { ...this.cash },
            simulatingPlayer: this.simulatingPlayer,
            floatingText: this.floatingText ? [...this.floatingText] : undefined,
            numBoughtSoldiers: this.numBoughtSoldiers,
            conqueredRegions: this.conqueredRegions ? [...this.conqueredRegions] : undefined,
            endResult: this.endResult,
            id: this.id + 1,
            gameId: this.gameId,
            players: [...this.players],
            regions: [...this.regions]
        });
    }

    // ==================== HELPER METHODS ====================

    /**
     * Get current active player
     */
    activePlayer(): Player {
        return this.players[this.playerIndex];
    }

    /**
     * Get all players
     */
    getPlayers(): Player[] {
        return [...this.players];
    }

    /**
     * Get all regions
     */
    getRegions(): Region[] {
        return [...this.regions];
    }

    /**
     * Advance to next player's turn
     */
    advanceToNextPlayer(players?: Player[]): Player {
        const playersList = players || this.players;
        let nextIndex = (this.playerIndex + 1) % playersList.length;

        // Skip eliminated players
        while (this.regionCount(playersList[nextIndex]) === 0 && nextIndex !== this.playerIndex) {
            nextIndex = (nextIndex + 1) % playersList.length;
        }

        const upcomingPlayer = playersList[nextIndex];

        // Update turn if we've cycled back to player 0
        if (nextIndex === 0 && this.playerIndex !== 0) {
            this.turnIndex++;
        }

        this.playerIndex = nextIndex;
        this.movesRemaining = this.calculateMovesForPlayer(upcomingPlayer);
        this.conqueredRegions = undefined;
        this.numBoughtSoldiers = undefined;

        return upcomingPlayer;
    }

    /**
     * Calculate number of moves for a player based on upgrades
     */
    private calculateMovesForPlayer(player: Player): number {
        const baseMoves = 3;
        const airUpgradeLevel = this.upgradeLevel(player, 'AIR');
        return baseMoves + airUpgradeLevel;
    }

    /**
     * Get upgrade definition by index
     */
    private getUpgradeByIndex(index: number): { name: string } | null {
        const upgrades = [
            { name: 'NONE' },
            { name: 'SOLDIER' },
            { name: 'AIR' },
            { name: 'DEFENSE' },
            { name: 'INCOME' },
            { name: 'REBUILD' }
        ];
        return upgrades[index] || null;
    }

    /**
     * Calculate income for a player
     */
    calculateIncome(player: Player): number {
        let income = 0;

        // Base income per region
        income += this.regionCount(player) * 5;

        // Temple income bonuses
        const temples = this.templesForPlayer(player);
        for (const temple of temples) {
            if (temple.upgradeIndex === 4) { // INCOME upgrade
                const incomeBonus = [5, 10, 20][temple.level] || 0;
                income += incomeBonus;
            }
        }

        return income;
    }

    /**
     * Serialize to JSON for API responses
     */
    toJSON(): any {
        return {
            gameId: this.gameId,
            turnIndex: this.turnIndex,
            playerIndex: this.playerIndex,
            movesRemaining: this.movesRemaining,
            owners: this.owners,
            temples: this.temples,
            soldiersByRegion: this.soldiersByRegion,
            cash: this.cash,
            floatingText: this.floatingText,
            numBoughtSoldiers: this.numBoughtSoldiers,
            conqueredRegions: this.conqueredRegions,
            endResult: this.endResult,
            id: this.id,
            players: this.players,
            regions: this.regions,
            status: this.endResult ? 'COMPLETED' : 'ACTIVE'
        };
    }

    /**
     * Create initial game state for World Conflict
     */
    static createInitialState(
        gameId: string,
        players: Player[],
        regions: Region[]
    ): WorldConflictGameState {
        const gameState = new WorldConflictGameState({
            gameId,
            players,
            regions,
            turnIndex: 1,
            playerIndex: 0,
            movesRemaining: 3,
            owners: {},
            temples: {},
            soldiersByRegion: {},
            cash: {},
            id: 1
        });

        // Initialize starting conditions
        gameState.initializeStartingConditions();

        return gameState;
    }

    /**
     * Set up initial game conditions
     */
    private initializeStartingConditions(): void {
        // Give each player starting cash
        for (const player of this.players) {
            this.cash[player.index] = 100;
        }

        // Distribute regions to players
        this.distributeStartingRegions();

        // Place initial armies
        this.placeInitialArmies();

        // Set up temples
        this.setupInitialTemples();
    }

    /**
     * Distribute regions among players at game start
     */
    private distributeStartingRegions(): void {
        const regionsPerPlayer = Math.floor(this.regions.length / this.players.length);

        for (let i = 0; i < this.regions.length; i++) {
            const playerIndex = Math.floor(i / regionsPerPlayer) % this.players.length;
            this.owners[this.regions[i].index] = playerIndex;
        }
    }

    /**
     * Place initial armies on owned regions
     */
    private placeInitialArmies(): void {
        for (const region of this.regions) {
            const owner = this.owner(region);
            if (owner) {
                this.addSoldiers(region.index, 3); // 3 starting armies per region
            }
        }
    }

    /**
     * Set up initial temples at temple sites
     */
    private setupInitialTemples(): void {
        for (const region of this.regions) {
            if (region.hasTemple) {
                this.temples[region.index] = {
                    regionIndex: region.index,
                    level: 0,
                    upgradeIndex: undefined
                };
            }
        }
    }
}
