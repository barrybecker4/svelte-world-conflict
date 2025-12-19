/**
 * Core game types for Galactic Conflict
 */

import type { GameStatus } from '$lib/game/constants/gameConstants';

// ==================== POSITION AND GEOMETRY ====================

export interface Position {
    x: number;
    y: number;
}

// ==================== PLAYER ====================

export interface Player {
    slotIndex: number;
    name: string;
    color: string;
    isAI: boolean;
    personality?: string; // AI personality type if AI player
}

export interface PlayerSlot {
    slotIndex: number;
    type: 'Set' | 'AI' | 'Open' | 'Disabled';
    name?: string;
    personality?: string; // AI personality
}

// ==================== PLANET ====================

export interface Planet {
    id: number;
    name: string;
    position: Position;
    /** Volume determines size and resource production (5-100) */
    volume: number;
    /** Player slot index who owns this planet, null if neutral */
    ownerId: number | null;
    /** Number of ships defending this planet */
    ships: number;
    /** Accumulated resources (only for owned planets) */
    resources: number;
}

// ==================== ARMADA ====================

export interface Armada {
    id: string;
    /** Player slot index who owns this armada */
    ownerId: number;
    /** Number of ships in this armada */
    ships: number;
    /** Planet ID where armada departed from */
    sourcePlanetId: number;
    /** Planet ID where armada is heading */
    destinationPlanetId: number;
    /** Unix timestamp when armada departed */
    departureTime: number;
    /** Unix timestamp when armada will arrive */
    arrivalTime: number;
}

// ==================== BATTLE REPLAY (for client animation) ====================

/**
 * A completed battle with full replay data for client animation
 */
export interface BattleReplay {
    id: string;
    planetId: number;
    planetName: string;
    
    /** Initial state before battle */
    attackerPlayerId: number;
    attackerName: string;
    attackerColor: string;
    attackerInitialShips: number;
    
    defenderPlayerId: number; // -1 for neutral
    defenderName: string;
    defenderColor: string;
    defenderInitialShips: number;
    
    /** Sequence of rounds for replay */
    rounds: BattleReplayRound[];
    
    /** Final outcome */
    winnerId: number | null; // null if mutual destruction
    winnerShipsRemaining: number;
    
    /** Timestamps */
    timestamp: number;
    
    /** Has this replay been played on the client? */
    played?: boolean;
}

export interface BattleReplayRound {
    roundNumber: number;
    attackerDice: number[];
    defenderDice: number[];
    attackerLosses: number;
    defenderLosses: number;
    attackerShipsAfter: number;
    defenderShipsAfter: number;
}

// ==================== REINFORCEMENT AND CONQUEST EVENTS ====================

/**
 * Event when reinforcements arrive at an owned planet
 */
export interface ReinforcementEvent {
    id: string;
    planetId: number;
    planetName: string;
    playerId: number;
    playerName: string;
    playerColor: string;
    ships: number;
    timestamp: number;
}

/**
 * Event when a planet is conquered without battle (no defenses)
 */
export interface ConquestEvent {
    id: string;
    planetId: number;
    planetName: string;
    attackerPlayerId: number;
    attackerName: string;
    attackerColor: string;
    ships: number;
    timestamp: number;
}

/**
 * Event when a player is eliminated (loses their last planet)
 */
export interface PlayerEliminationEvent {
    id: string;
    planetId: number;
    planetName: string;
    playerId: number;
    playerName: string;
    playerColor: string;
    timestamp: number;
}

// ==================== EVENTS ====================

export type GameEventType = 
    | 'armada_arrival'
    | 'resource_tick'
    | 'game_end';

export interface GameEvent {
    id: string;
    type: GameEventType;
    /** Unix timestamp when this event should be processed */
    scheduledTime: number;
    payload: ArmadaArrivalPayload | ResourceTickPayload | GameEndPayload;
}

export interface ArmadaArrivalPayload {
    armadaId: string;
}

export interface ResourceTickPayload {
    // No additional data needed - processes all planets
}

export interface GameEndPayload {
    reason: 'time_expired' | 'single_player_remaining';
}

// ==================== GAME STATE ====================

export interface GalacticGameStateData {
    gameId: string;
    status: GameStatus;
    
    /** Unix timestamp when the game started */
    startTime: number;
    /** Game duration in minutes */
    durationMinutes: number;
    /** Armada travel speed (units per minute) */
    armadaSpeed: number;
    /** Resources generated per planet volume per minute */
    productionRate: number;
    
    /** All planets in the galaxy */
    planets: Planet[];
    /** All players in the game */
    players: Player[];
    /** All in-transit armadas */
    armadas: Armada[];
    /** Scheduled future events */
    eventQueue: GameEvent[];
    
    /** 
     * Global resources per player (player slot index -> resource count)
     * Resources accumulate from all owned planets into a single pool
     */
    resourcesByPlayer: Record<number, number>;
    
    /** 
     * Recently completed battle replays for client animation
     * Cleared after being sent to clients
     */
    recentBattleReplays: BattleReplay[];
    
    /**
     * Recent reinforcement events for client display
     * Cleared after being sent to clients
     */
    recentReinforcementEvents: ReinforcementEvent[];
    
    /**
     * Recent conquest events for client display
     * Cleared after being sent to clients
     */
    recentConquestEvents: ConquestEvent[];
    
    /**
     * Recent player elimination events for client display
     * Cleared after being sent to clients
     */
    recentPlayerEliminationEvents: PlayerEliminationEvent[];
    
    /** Result when game ends */
    endResult?: Player | 'DRAWN_GAME' | null;
    
    /** Eliminated player slot indices */
    eliminatedPlayers: number[];
    
    /** Random number generator state for deterministic gameplay */
    rngSeed?: string;
    rngState?: any;
    
    /** Last state update timestamp */
    lastUpdateTime: number;
}

// ==================== PENDING GAME (WAITING ROOM) ====================

export interface PendingGameConfiguration {
    playerSlots: PlayerSlot[];
    settings?: GameSettings;
}

export interface GameSettings {
    /** Number of neutral planets (total planets = players + neutralPlanetCount) */
    neutralPlanetCount: number;
    armadaSpeed: number;
    gameDuration: number;
    stateBroadcastInterval: number;
    aiDifficulty?: string;
    /** Minimum defending ships on neutral planets */
    neutralShipsMin: number;
    /** Maximum multiplier for neutral planet defenders (applied to production) */
    neutralShipsMultiplierMax: number;
    /** Resources generated per planet volume per minute */
    productionRate: number;
}

export interface PendingGameData {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    creator?: string;
    playerCount?: number;
    maxPlayers?: number;
    createdAt?: number;
    gameType?: string;
    players: Array<{ slotIndex: number; name: string }>;
    pendingConfiguration?: PendingGameConfiguration;
}

// ==================== STATE UPDATES (FOR WEBSOCKET) ====================

export interface PlanetUpdate {
    id: number;
    ownerId?: number | null;
    ships?: number;
    resources?: number;
}

export interface StateUpdate {
    timestamp: number;
    gameTime: number; // Elapsed time in milliseconds
    planets: PlanetUpdate[];
    armadas: Armada[];
    recentEvents: GameEvent[];
    eliminatedPlayers: number[];
    endResult?: Player | 'DRAWN_GAME' | null;
}

// ==================== MOVE TYPES ====================

export interface SendArmadaAction {
    type: 'send_armada';
    sourcePlanetId: number;
    destinationPlanetId: number;
    shipCount: number;
}

export interface BuildShipsAction {
    type: 'build_ships';
    planetId: number;
    shipCount: number;
}

export type PlayerAction = SendArmadaAction | BuildShipsAction;

// ==================== API TYPES ====================

export interface CreateGameRequest {
    playerName: string;
    gameType: string;
    armadaSpeed: number;
    gameDuration: number;
    playerSlots: PlayerSlot[];
    settings: GameSettings;
}

export interface CreateGameResponse {
    gameId: string;
    status: GameStatus;
    player: { slotIndex: number; name: string };
}

export interface JoinGameResponse {
    success: boolean;
    player?: { slotIndex: number; name: string };
    error?: string;
}

