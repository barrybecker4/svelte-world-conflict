export interface Player {
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
    upgradeIndex?: number; // Index into UPGRADES array
    maxLevel?: number;
}

export interface Upgrade {
    index: number;
    name: string;
    displayName: string;
    description: string;
    cost: number[];
    level: number[];
    maxLevel: number;
    type: UpgradeType;
}

export enum UpgradeType {
    MILITARY = 'MILITARY',
    ECONOMIC = 'ECONOMIC',
    DEFENSIVE = 'DEFENSIVE',
    UTILITY = 'UTILITY'
}

// ==================== GAME STATE TYPES ====================

export interface GameStateSnapshot {
    turnIndex: number;
    playerIndex: number;
    movesRemaining: number;
    owners: Record<number, number>;
    temples: Record<number, Temple>;
    soldiersByRegion: Record<number, Soldier[]>;
    cash: Record<number, number>;
    id: number;
    gameId: string;
    timestamp: string;
}

export interface Soldier {
    i: number; // unique id
}

export interface FloatingText {
    regionIdx: number;
    text: string;
    color: string;
    width: number;
    duration?: number;
}

// ==================== COMMAND TYPES ====================

export interface Command {
    type: string;
    playerId: number;
    timestamp: string;
    id: string;
}

export interface ArmyMoveCommand extends Command {
    type: 'ArmyMove';
    source: number;
    destination: number;
    count: number;
}

export interface BuildUpgradeCommand extends Command {
    type: 'BuildUpgrade';
    regionIndex: number;
    upgradeIndex: number;
}

export interface EndMoveCommand extends Command {
    type: 'EndMove';
}

export interface ResignationCommand extends Command {
    type: 'Resignation';
}

export interface BuySoldierCommand extends Command {
    type: 'BuySoldier';
    regionIndex: number;
    count: number;
}

// ==================== COMBAT TYPES ====================

export interface CombatResult {
    attackerLosses: number;
    defenderLosses: number;
    territoryConquered: boolean;
    battleLog: BattleRound[];
}

export interface BattleRound {
    attackerRoll: number;
    defenderRoll: number;
    attackerWins: boolean;
    attackerLosses: number;
    defenderLosses: number;
}

export interface AttackSequence {
    rounds: BattleRound[];
    finalResult: CombatResult;
    attackerStartCount: number;
    defenderStartCount: number;
}

// ==================== GAME CONFIGURATION ====================

export interface GameConfig {
    maxPlayers: number;
    baseMoves: number;
    maxTurns: number;
    startingCash: number;
    startingArmies: number;
    aiDifficulty: AILevel;
    gameSpeed: GameSpeed;
    fogOfWar: boolean;
}

export enum AILevel {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD'
}

export enum GameSpeed {
    SLOW = 'SLOW',
    NORMAL = 'NORMAL',
    FAST = 'FAST'
}

// ==================== MULTIPLAYER TYPES ====================

export interface GameSession {
    id: string;
    players: Player[];
    currentState: GameStateSnapshot;
    config: GameConfig;
    status: GameStatus;
    createdAt: string;
    updatedAt: string;
}

export enum GameStatus {
    WAITING = 'WAITING',
    ACTIVE = 'ACTIVE',
    PAUSED = 'PAUSED',
    FINISHED = 'FINISHED'
}

export interface PlayerAction {
    playerId: number;
    action: Command;
    timestamp: string;
}

export interface GameEvent {
    type: string;
    data: any;
    timestamp: string;
    playerId?: number;
}

// ==================== UI TYPES ====================

export interface MapViewport {
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
}

export interface RegionStyle {
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
}

export interface UIState {
    selectedRegion: number | null;
    hoveredRegion: number | null;
    showingTemplates: boolean;
    showingUpgrades: boolean;
    currentView: ViewMode;
    mapViewport: MapViewport;
}

export enum ViewMode {
    OVERVIEW = 'OVERVIEW',
    DETAILED = 'DETAILED',
    COMBAT = 'COMBAT'
}

// ==================== VALIDATION TYPES ====================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
}

export interface MoveValidation extends ValidationResult {
    canMove: boolean;
    requiredMoves: number;
    estimatedCombatOutcome?: CombatResult;
}

// ==================== GAME CONSTANTS ====================

export const GAME_CONSTANTS = {
    BASE_MOVES_PER_TURN: 3,
    MAX_TEMPLE_LEVEL: 3,
    MAX_UPGRADE_LEVEL: 3,
    DEFAULT_STARTING_CASH: 100,
    DEFAULT_STARTING_ARMIES: 3,
    MAX_GAME_TURNS: 100,
    TEMPLE_INCOME_BASE: 10,
    SOLDIER_GENERATION_PER_TEMPLE: 1,
    COMBAT_DICE_SIDES: 6,

    // Upgrade names (matching original)
    UPGRADES: {
        SOLDIER: 'SOLDIER',
        AIR: 'AIR',
        DEFENSE: 'DEFENSE',
        INCOME: 'INCOME',
        REBUILD: 'REBUILD'
    },

    // Temple levels
    TEMPLE_LEVELS: ['Basic', 'Advanced', 'Elite', 'Master'],

    // Game results
    DRAWN_GAME: 'DRAWN_GAME' as const
} as const;

// ==================== HELPER TYPES ====================

export type PlayerIndex = number;
export type RegionIndex = number;
export type UpgradeIndex = number;
export type TemplateLevel = number;
export type GameResult = Player | typeof GAME_CONSTANTS.DRAWN_GAME;

// Type guards for runtime checking
export function isPlayer(obj: any): obj is Player {
    return obj && typeof obj.index === 'number' && typeof obj.name === 'string';
}

export function isRegion(obj: any): obj is Region {
    return obj && typeof obj.index === 'number' && typeof obj.name === 'string' && Array.isArray(obj.neighbors);
}

export function isTemple(obj: any): obj is Temple {
    return obj && typeof obj.regionIndex === 'number' && typeof obj.level === 'number';
}

export function isCommand(obj: any): obj is Command {
    return obj && typeof obj.type === 'string' && typeof obj.playerId === 'number';
}
