/**
 * GalacticGameState - Central game state management for Galactic Conflict
 */

import type {
    GalacticGameStateData,
    Planet,
    Player,
    Armada,
    Battle,
    BattleReplay,
    ReinforcementEvent,
    ConquestEvent,
    PlayerEliminationEvent,
    GameEvent,
    PlayerSlot,
    GameSettings,
    StateUpdate,
    PlanetUpdate,
} from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS, GAME_STATUS, getPlayerColor } from '$lib/game/constants/gameConstants';
import { GalaxyGenerator } from '$lib/game/map/GalaxyGenerator';
import { RandomNumberGenerator } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';

export class GalacticGameState {
    public state: GalacticGameStateData;
    public rng: RandomNumberGenerator;

    constructor(data: GalacticGameStateData) {
        this.state = { ...data };

        // Initialize defaults
        if (!this.state.planets) this.state.planets = [];
        if (!this.state.players) this.state.players = [];
        if (!this.state.armadas) this.state.armadas = [];
        if (!this.state.activeBattles) this.state.activeBattles = [];
        if (!this.state.eventQueue) this.state.eventQueue = [];
        if (!this.state.eliminatedPlayers) this.state.eliminatedPlayers = [];
        if (!this.state.recentBattleReplays) this.state.recentBattleReplays = [];
        if (!this.state.recentReinforcementEvents) this.state.recentReinforcementEvents = [];
        if (!this.state.recentConquestEvents) this.state.recentConquestEvents = [];
        if (!this.state.recentPlayerEliminationEvents) this.state.recentPlayerEliminationEvents = [];
        if (!this.state.resourcesByPlayer) this.state.resourcesByPlayer = {};

        // Initialize or restore RNG
        if (this.state.rngSeed && this.state.rngState) {
            this.rng = new RandomNumberGenerator(this.state.rngSeed, this.state.rngState);
        } else if (this.state.rngSeed) {
            this.rng = new RandomNumberGenerator(this.state.rngSeed);
        } else {
            this.state.rngSeed = `galactic-${Date.now()}`;
            this.rng = new RandomNumberGenerator(this.state.rngSeed);
        }
    }

    /**
     * Create initial game state from configuration
     */
    static createInitialState(
        gameId: string,
        playerSlots: PlayerSlot[],
        settings: GameSettings,
        seed?: string
    ): GalacticGameState {
        logger.debug(`Creating initial game state for ${gameId}`);

        // Create players from slots
        const players = GalacticGameState.createPlayersFromSlots(playerSlots);

        // Generate galaxy
        const generator = new GalaxyGenerator(
            GALACTIC_CONSTANTS.GALAXY_WIDTH,
            GALACTIC_CONSTANTS.GALAXY_HEIGHT,
            seed || `galaxy-${gameId}`
        );

        const planets = generator.generate({
            planetCount: settings.planetCount,
            playerCount: players.length,
            players,
            seed,
            neutralShipsMin: settings.neutralShipsMin,
            neutralShipsMultiplierMax: settings.neutralShipsMultiplierMax,
        });

        const now = Date.now();

        // Initialize player resources (start with 0)
        const resourcesByPlayer: Record<number, number> = {};
        for (const player of players) {
            resourcesByPlayer[player.slotIndex] = 0;
        }

        const initialState: GalacticGameStateData = {
            gameId,
            status: GAME_STATUS.ACTIVE,
            startTime: now,
            durationMinutes: settings.gameDuration,
            armadaSpeed: settings.armadaSpeed,
            productionRate: settings.productionRate,
            planets,
            players,
            armadas: [],
            activeBattles: [],
            eventQueue: [],
            resourcesByPlayer,
            recentBattleReplays: [],
            recentReinforcementEvents: [],
            recentConquestEvents: [],
            recentPlayerEliminationEvents: [],
            eliminatedPlayers: [],
            rngSeed: seed || `galactic-${gameId}`,
            lastUpdateTime: now,
        };

        const state = new GalacticGameState(initialState);

        // Schedule first resource tick
        state.scheduleResourceTick(now + GALACTIC_CONSTANTS.RESOURCE_TICK_INTERVAL_MS);

        // Schedule game end
        const gameEndTime = now + settings.gameDuration * 60 * 1000;
        state.scheduleEvent({
            id: uuidv4(),
            type: 'game_end',
            scheduledTime: gameEndTime,
            payload: { reason: 'time_expired' },
        });

        return state;
    }

    /**
     * Create Player objects from PlayerSlots
     */
    private static createPlayersFromSlots(slots: PlayerSlot[]): Player[] {
        return slots
            .filter(slot => slot.type === 'Set' || slot.type === 'AI')
            .map(slot => ({
                slotIndex: slot.slotIndex,
                name: slot.name || `Player ${slot.slotIndex + 1}`,
                color: getPlayerColor(slot.slotIndex),
                isAI: slot.type === 'AI',
                personality: slot.personality,
            }));
    }

    /**
     * Create from JSON data
     */
    static fromJSON(data: GalacticGameStateData): GalacticGameState {
        return new GalacticGameState(data);
    }

    // ==================== ACCESSORS ====================

    get gameId(): string { return this.state.gameId; }
    get status(): string { return this.state.status; }
    get startTime(): number { return this.state.startTime; }
    get durationMinutes(): number { return this.state.durationMinutes; }
    get armadaSpeed(): number { return this.state.armadaSpeed; }
    get planets(): Planet[] { return [...this.state.planets]; }
    get players(): Player[] { return [...this.state.players]; }
    get armadas(): Armada[] { return [...this.state.armadas]; }
    get activeBattles(): Battle[] { return [...this.state.activeBattles]; }
    get eventQueue(): GameEvent[] { return [...this.state.eventQueue]; }
    get eliminatedPlayers(): number[] { return [...this.state.eliminatedPlayers]; }
    get recentBattleReplays(): BattleReplay[] { return [...this.state.recentBattleReplays]; }
    get recentReinforcementEvents(): ReinforcementEvent[] { return [...this.state.recentReinforcementEvents]; }
    get recentConquestEvents(): ConquestEvent[] { return [...this.state.recentConquestEvents]; }
    get recentPlayerEliminationEvents(): PlayerEliminationEvent[] { return [...this.state.recentPlayerEliminationEvents]; }

    get endResult(): Player | 'DRAWN_GAME' | null | undefined { return this.state.endResult; }
    set endResult(value: Player | 'DRAWN_GAME' | null | undefined) { this.state.endResult = value; }
    get resourcesByPlayer(): Record<number, number> { return { ...this.state.resourcesByPlayer }; }

    // ==================== PLANET MANAGEMENT ====================

    getPlanet(planetId: number): Planet | undefined {
        return this.state.planets.find(p => p.id === planetId);
    }

    getPlanetsOwnedBy(playerId: number): Planet[] {
        return this.state.planets.filter(p => p.ownerId === playerId);
    }

    setPlanetOwner(planetId: number, ownerId: number | null): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ownerId = ownerId;
        }
    }

    setPlanetShips(planetId: number, ships: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ships = Math.max(0, ships);
        }
    }

    addPlanetShips(planetId: number, ships: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ships = Math.max(0, planet.ships + ships);
        }
    }

    addPlanetResources(planetId: number, resources: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.resources = Math.max(0, planet.resources + resources);
        }
    }

    spendPlanetResources(planetId: number, amount: number): boolean {
        const planet = this.getPlanet(planetId);
        if (planet && planet.resources >= amount) {
            planet.resources -= amount;
            return true;
        }
        return false;
    }

    // ==================== PLAYER MANAGEMENT ====================

    getPlayer(slotIndex: number): Player | undefined {
        return this.state.players.find(p => p.slotIndex === slotIndex);
    }

    isPlayerEliminated(slotIndex: number): boolean {
        return this.state.eliminatedPlayers.includes(slotIndex);
    }

    eliminatePlayer(slotIndex: number): void {
        if (!this.isPlayerEliminated(slotIndex)) {
            this.state.eliminatedPlayers.push(slotIndex);
        }
    }

    /**
     * Check if a player has any planets or ships (armadas)
     */
    isPlayerAlive(slotIndex: number): boolean {
        const hasPlanets = this.state.planets.some(p => p.ownerId === slotIndex);
        const hasShips = this.state.armadas.some(a => a.ownerId === slotIndex);
        const hasPlanetShips = this.state.planets.some(p => p.ownerId === slotIndex && p.ships > 0);
        return hasPlanets || hasShips || hasPlanetShips;
    }

    /**
     * Get total ships for a player (on planets + in armadas)
     */
    getTotalShips(slotIndex: number): number {
        const planetShips = this.state.planets
            .filter(p => p.ownerId === slotIndex)
            .reduce((sum, p) => sum + p.ships, 0);
        const armadaShips = this.state.armadas
            .filter(a => a.ownerId === slotIndex)
            .reduce((sum, a) => sum + a.ships, 0);
        return planetShips + armadaShips;
    }

    /**
     * Get player's global resources
     */
    getPlayerResources(slotIndex: number): number {
        return this.state.resourcesByPlayer[slotIndex] ?? 0;
    }

    /**
     * Add resources to a player's global pool
     */
    addPlayerResources(slotIndex: number, amount: number): void {
        if (!this.state.resourcesByPlayer[slotIndex]) {
            this.state.resourcesByPlayer[slotIndex] = 0;
        }
        this.state.resourcesByPlayer[slotIndex] += amount;
    }

    /**
     * Spend resources from a player's global pool
     * Returns true if successful, false if not enough resources
     */
    spendPlayerResources(slotIndex: number, amount: number): boolean {
        const currentResources = this.getPlayerResources(slotIndex);
        if (currentResources >= amount) {
            this.state.resourcesByPlayer[slotIndex] = currentResources - amount;
            return true;
        }
        return false;
    }

    /**
     * Get total resources for a player (alias for getPlayerResources for compatibility)
     */
    getTotalResources(slotIndex: number): number {
        return this.getPlayerResources(slotIndex);
    }

    // ==================== ARMADA MANAGEMENT ====================

    addArmada(armada: Armada): void {
        this.state.armadas.push(armada);

        // Schedule arrival event
        this.scheduleEvent({
            id: uuidv4(),
            type: 'armada_arrival',
            scheduledTime: armada.arrivalTime,
            payload: { armadaId: armada.id },
        });
    }

    removeArmada(armadaId: string): Armada | undefined {
        const index = this.state.armadas.findIndex(a => a.id === armadaId);
        if (index >= 0) {
            return this.state.armadas.splice(index, 1)[0];
        }
        return undefined;
    }

    getArmada(armadaId: string): Armada | undefined {
        return this.state.armadas.find(a => a.id === armadaId);
    }

    getArmadasForPlayer(slotIndex: number): Armada[] {
        return this.state.armadas.filter(a => a.ownerId === slotIndex);
    }

    // ==================== BATTLE MANAGEMENT ====================

    addBattle(battle: Battle): void {
        // Note: Battles are now resolved immediately by BattleManager
        // This method is kept for compatibility but battles are no longer scheduled
        this.state.activeBattles.push(battle);
    }

    getBattle(battleId: string): Battle | undefined {
        return this.state.activeBattles.find(b => b.id === battleId);
    }

    getBattleAtPlanet(planetId: number): Battle | undefined {
        return this.state.activeBattles.find(b => b.planetId === planetId && b.status === 'active');
    }

    removeBattle(battleId: string): Battle | undefined {
        const index = this.state.activeBattles.findIndex(b => b.id === battleId);
        if (index >= 0) {
            return this.state.activeBattles.splice(index, 1)[0];
        }
        return undefined;
    }

    // ==================== BATTLE REPLAYS ====================

    /**
     * Add a battle replay for client animation
     */
    addBattleReplay(replay: BattleReplay): void {
        this.state.recentBattleReplays.push(replay);
        console.log(`[GalacticGameState] Added battle replay ${replay.id} for planet ${replay.planetName}, total replays: ${this.state.recentBattleReplays.length}`);
    }

    /**
     * Clear replays that have been sent to clients
     * Called after state broadcast
     */
    clearBattleReplays(): void {
        this.state.recentBattleReplays = [];
    }

    /**
     * Get pending battle replays
     */
    getPendingReplays(): BattleReplay[] {
        return [...this.state.recentBattleReplays];
    }

    // ==================== REINFORCEMENT AND CONQUEST EVENTS ====================

    /**
     * Add a reinforcement event for client display
     */
    addReinforcementEvent(event: ReinforcementEvent): void {
        this.state.recentReinforcementEvents.push(event);
        logger.debug(`[GalacticGameState] Added reinforcement event ${event.id} for planet ${event.planetName}`);
    }

    /**
     * Add a conquest event for client display
     */
    addConquestEvent(event: ConquestEvent): void {
        this.state.recentConquestEvents.push(event);
        logger.debug(`[GalacticGameState] Added conquest event ${event.id} for planet ${event.planetName}`);
    }

    /**
     * Clear reinforcement events that have been sent to clients
     * Called after state broadcast
     */
    clearReinforcementEvents(): void {
        this.state.recentReinforcementEvents = [];
    }

    /**
     * Clear conquest events that have been sent to clients
     * Called after state broadcast
     */
    clearConquestEvents(): void {
        this.state.recentConquestEvents = [];
    }

    /**
     * Add a player elimination event for client display
     */
    addPlayerEliminationEvent(event: PlayerEliminationEvent): void {
        this.state.recentPlayerEliminationEvents.push(event);
        logger.debug(`[GalacticGameState] Added player elimination event ${event.id} for player ${event.playerName} at planet ${event.planetName}`);
    }

    /**
     * Clear player elimination events that have been sent to clients
     * Called after state broadcast
     */
    clearPlayerEliminationEvents(): void {
        this.state.recentPlayerEliminationEvents = [];
    }

    // ==================== EVENT QUEUE ====================

    scheduleEvent(event: GameEvent): void {
        this.state.eventQueue.push(event);
        // Keep queue sorted by scheduled time
        this.state.eventQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    }

    getNextEvent(): GameEvent | undefined {
        return this.state.eventQueue[0];
    }

    popNextEvent(): GameEvent | undefined {
        return this.state.eventQueue.shift();
    }

    removeEvent(eventId: string): void {
        const index = this.state.eventQueue.findIndex(e => e.id === eventId);
        if (index >= 0) {
            this.state.eventQueue.splice(index, 1);
        }
    }

    scheduleResourceTick(time: number): void {
        this.scheduleEvent({
            id: uuidv4(),
            type: 'resource_tick',
            scheduledTime: time,
            payload: {},
        });
    }

    // ==================== GAME STATE ====================

    isGameComplete(): boolean {
        return this.state.status === GAME_STATUS.COMPLETED;
    }

    getGameTimeElapsed(): number {
        return Date.now() - this.state.startTime;
    }

    getGameTimeRemaining(): number {
        const endTime = this.state.startTime + this.state.durationMinutes * 60 * 1000;
        return Math.max(0, endTime - Date.now());
    }

    /**
     * Determine the winner based on planets owned (then ships, then resources)
     */
    determineWinner(): Player | 'DRAWN_GAME' | null {
        const activePlayers = this.state.players.filter(p => !this.isPlayerEliminated(p.slotIndex));

        if (activePlayers.length === 0) {
            return GALACTIC_CONSTANTS.DRAWN_GAME;
        }

        if (activePlayers.length === 1) {
            return activePlayers[0];
        }

        // Score players: primary = planets, tiebreaker = ships, then resources
        const scores = activePlayers.map(p => ({
            player: p,
            planets: this.getPlanetsOwnedBy(p.slotIndex).length,
            ships: this.getTotalShips(p.slotIndex),
            resources: this.getTotalResources(p.slotIndex),
        }));

        scores.sort((a, b) => {
            if (a.planets !== b.planets) return b.planets - a.planets;
            if (a.ships !== b.ships) return b.ships - a.ships;
            return b.resources - a.resources;
        });

        // Check for tie
        const top = scores[0];
        const second = scores[1];
        if (top.planets === second.planets && top.ships === second.ships && top.resources === second.resources) {
            return GALACTIC_CONSTANTS.DRAWN_GAME;
        }

        return top.player;
    }

    // ==================== STATE UPDATES ====================

    /**
     * Generate a state update for broadcasting to clients
     */
    generateStateUpdate(lastUpdateTime: number): StateUpdate {
        const now = Date.now();
        const recentEvents = this.state.eventQueue.filter(e => e.scheduledTime <= now);

        // Generate planet updates (only for planets that changed)
        const planetUpdates: PlanetUpdate[] = this.state.planets.map(p => ({
            id: p.id,
            ownerId: p.ownerId,
            ships: p.ships,
            resources: p.resources,
        }));

        return {
            timestamp: now,
            gameTime: now - this.state.startTime,
            planets: planetUpdates,
            armadas: [...this.state.armadas],
            activeBattles: [...this.state.activeBattles],
            recentEvents,
            eliminatedPlayers: [...this.state.eliminatedPlayers],
            endResult: this.state.endResult,
        };
    }

    // ==================== SERIALIZATION ====================

    toJSON(): GalacticGameStateData {
        const rngState = this.rng.getState();

        return {
            ...this.state,
            planets: this.state.planets.map(p => ({ ...p })),
            players: this.state.players.map(p => ({ ...p })),
            armadas: this.state.armadas.map(a => ({ ...a })),
            activeBattles: this.state.activeBattles.map(b => ({
                ...b,
                participants: b.participants.map(p => ({ ...p })),
                rounds: b.rounds.map(r => ({ ...r })),
            })),
            eventQueue: this.state.eventQueue.map(e => ({ ...e })),
            resourcesByPlayer: { ...this.state.resourcesByPlayer },
            recentBattleReplays: this.state.recentBattleReplays.map(r => ({
                ...r,
                rounds: r.rounds.map(round => ({ ...round })),
            })),
            recentReinforcementEvents: this.state.recentReinforcementEvents.map(e => ({ ...e })),
            recentConquestEvents: this.state.recentConquestEvents.map(e => ({ ...e })),
            recentPlayerEliminationEvents: this.state.recentPlayerEliminationEvents.map(e => ({ ...e })),
            eliminatedPlayers: [...this.state.eliminatedPlayers],
            rngSeed: rngState.seed,
            rngState: rngState.state,
            lastUpdateTime: Date.now(),
        };
    }

    clone(): GalacticGameState {
        return new GalacticGameState(this.toJSON());
    }
}

