/**
 * GalacticGameState - Central game state management for Galactic Conflict
 */

import type {
    GalacticGameStateData,
    Planet,
    Player,
    Armada,
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
import { GALACTIC_CONSTANTS, GAME_STATUS } from '$lib/game/constants/gameConstants';
import { getPlayerColor } from '$lib/game/constants/playerConfigs';
import { GalaxyGenerator } from '$lib/game/map/GalaxyGenerator';
import { RandomNumberGenerator } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';
import { v4 as uuidv4 } from 'uuid';
import { PlanetManager } from './PlanetManager';
import { PlayerManager } from './PlayerManager';
import { ArmadaManager } from './ArmadaManager';
import { EventManager } from './EventManager';

export class GalacticGameState {
    public state: GalacticGameStateData;
    public rng: RandomNumberGenerator;
    
    // Manager instances
    private planetManager: PlanetManager;
    private playerManager: PlayerManager;
    private armadaManager: ArmadaManager;
    private eventManager: EventManager;

    constructor(data: GalacticGameStateData) {
        this.state = { ...data };

        // Initialize defaults
        if (!this.state.planets) this.state.planets = [];
        if (!this.state.players) this.state.players = [];
        if (!this.state.armadas) this.state.armadas = [];
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

        // Initialize managers
        this.planetManager = new PlanetManager(this.state.planets);
        this.playerManager = new PlayerManager(
            this.state.players,
            this.state.eliminatedPlayers,
            this.state.resourcesByPlayer
        );
        this.eventManager = new EventManager(
            this.state.eventQueue,
            this.state.recentBattleReplays,
            this.state.recentReinforcementEvents,
            this.state.recentConquestEvents,
            this.state.recentPlayerEliminationEvents
        );
        this.armadaManager = new ArmadaManager(this.state.armadas);
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

        // Calculate total planets: players + neutral planets
        const totalPlanetCount = players.length + settings.neutralPlanetCount;

        // Generate galaxy
        const generator = new GalaxyGenerator(
            GALACTIC_CONSTANTS.GALAXY_WIDTH,
            GALACTIC_CONSTANTS.GALAXY_HEIGHT,
            seed || `galaxy-${gameId}`
        );

        const planets = generator.generate({
            planetCount: totalPlanetCount,
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
                difficulty: slot.difficulty,
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
    get eventQueue(): GameEvent[] { return [...this.eventManager.getEventQueue()]; }
    get eliminatedPlayers(): number[] { return [...this.playerManager.getEliminatedPlayers()]; }
    get recentBattleReplays(): BattleReplay[] { return [...this.eventManager.getBattleReplays()]; }
    get recentReinforcementEvents(): ReinforcementEvent[] { return [...this.eventManager.getReinforcementEvents()]; }
    get recentConquestEvents(): ConquestEvent[] { return [...this.eventManager.getConquestEvents()]; }
    get recentPlayerEliminationEvents(): PlayerEliminationEvent[] { return [...this.eventManager.getPlayerEliminationEvents()]; }

    get endResult(): Player | 'DRAWN_GAME' | null | undefined { return this.state.endResult; }
    set endResult(value: Player | 'DRAWN_GAME' | null | undefined) { this.state.endResult = value; }
    get resourcesByPlayer(): Record<number, number> { return { ...this.playerManager.getResourcesByPlayer() }; }

    // ==================== PLANET MANAGEMENT ====================

    getPlanet(planetId: number): Planet | undefined {
        return this.planetManager.getPlanet(planetId);
    }

    getPlanetsOwnedBy(playerId: number): Planet[] {
        return this.planetManager.getPlanetsOwnedBy(playerId);
    }

    setPlanetOwner(planetId: number, ownerId: number | null): void {
        this.planetManager.setPlanetOwner(planetId, ownerId);
    }

    setPlanetShips(planetId: number, ships: number): void {
        this.planetManager.setPlanetShips(planetId, ships);
    }

    addPlanetShips(planetId: number, ships: number): void {
        this.planetManager.addPlanetShips(planetId, ships);
    }

    addPlanetResources(planetId: number, resources: number): void {
        this.planetManager.addPlanetResources(planetId, resources);
    }

    spendPlanetResources(planetId: number, amount: number): boolean {
        return this.planetManager.spendPlanetResources(planetId, amount);
    }

    // ==================== PLAYER MANAGEMENT ====================

    getPlayer(slotIndex: number): Player | undefined {
        return this.playerManager.getPlayer(slotIndex);
    }

    isPlayerEliminated(slotIndex: number): boolean {
        return this.playerManager.isPlayerEliminated(slotIndex);
    }

    eliminatePlayer(slotIndex: number): void {
        this.playerManager.eliminatePlayer(slotIndex);
    }

    /**
     * Check if a player has any planets or ships (armadas)
     */
    isPlayerAlive(slotIndex: number): boolean {
        return this.playerManager.isPlayerAlive(slotIndex, this.state.planets, this.state.armadas);
    }

    /**
     * Get total ships for a player (on planets + in armadas)
     */
    getTotalShips(slotIndex: number): number {
        return this.playerManager.getTotalShips(slotIndex, this.state.planets, this.state.armadas);
    }

    /**
     * Get player's global resources
     */
    getPlayerResources(slotIndex: number): number {
        return this.playerManager.getPlayerResources(slotIndex);
    }

    /**
     * Add resources to a player's global pool
     */
    addPlayerResources(slotIndex: number, amount: number): void {
        this.playerManager.addPlayerResources(slotIndex, amount);
    }

    /**
     * Spend resources from a player's global pool
     * Returns true if successful, false if not enough resources
     */
    spendPlayerResources(slotIndex: number, amount: number): boolean {
        return this.playerManager.spendPlayerResources(slotIndex, amount);
    }

    /**
     * Get total resources for a player (alias for getPlayerResources for compatibility)
     */
    getTotalResources(slotIndex: number): number {
        return this.playerManager.getTotalResources(slotIndex);
    }

    // ==================== ARMADA MANAGEMENT ====================

    addArmada(armada: Armada): void {
        this.armadaManager.addArmada(armada);
    }

    removeArmada(armadaId: string): Armada | undefined {
        return this.armadaManager.removeArmada(armadaId);
    }

    getArmada(armadaId: string): Armada | undefined {
        return this.armadaManager.getArmada(armadaId);
    }

    getArmadasForPlayer(slotIndex: number): Armada[] {
        return this.armadaManager.getArmadasForPlayer(slotIndex);
    }

    // ==================== BATTLE REPLAYS ====================

    /**
     * Add a battle replay for client animation
     */
    addBattleReplay(replay: BattleReplay): void {
        this.eventManager.addBattleReplay(replay);
    }

    /**
     * Clear replays that have been sent to clients
     * Called after state broadcast
     */
    clearBattleReplays(): void {
        this.eventManager.clearBattleReplays();
    }

    /**
     * Get pending battle replays
     */
    getPendingReplays(): BattleReplay[] {
        return this.eventManager.getPendingReplays();
    }

    // ==================== REINFORCEMENT AND CONQUEST EVENTS ====================

    /**
     * Add a reinforcement event for client display
     */
    addReinforcementEvent(event: ReinforcementEvent): void {
        this.eventManager.addReinforcementEvent(event);
    }

    /**
     * Add a conquest event for client display
     */
    addConquestEvent(event: ConquestEvent): void {
        this.eventManager.addConquestEvent(event);
    }

    /**
     * Clear reinforcement events that have been sent to clients
     * Called after state broadcast
     */
    clearReinforcementEvents(): void {
        this.eventManager.clearReinforcementEvents();
    }

    /**
     * Clear conquest events that have been sent to clients
     * Called after state broadcast
     */
    clearConquestEvents(): void {
        this.eventManager.clearConquestEvents();
    }

    /**
     * Add a player elimination event for client display
     */
    addPlayerEliminationEvent(event: PlayerEliminationEvent): void {
        this.eventManager.addPlayerEliminationEvent(event);
    }

    /**
     * Clear player elimination events that have been sent to clients
     * Called after state broadcast
     */
    clearPlayerEliminationEvents(): void {
        this.eventManager.clearPlayerEliminationEvents();
    }

    // ==================== EVENT QUEUE ====================

    scheduleEvent(event: GameEvent): void {
        this.eventManager.scheduleEvent(event);
    }

    getNextEvent(): GameEvent | undefined {
        return this.eventManager.getNextEvent();
    }

    popNextEvent(): GameEvent | undefined {
        return this.eventManager.popNextEvent();
    }

    removeEvent(eventId: string): void {
        this.eventManager.removeEvent(eventId);
    }

    scheduleResourceTick(time: number): void {
        this.eventManager.scheduleResourceTick(time);
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

