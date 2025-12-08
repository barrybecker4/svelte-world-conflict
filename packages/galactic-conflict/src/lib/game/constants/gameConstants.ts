/**
 * Game constants for Galactic Conflict
 * All configurable parameters for galaxy generation, gameplay, and timing
 */

export const GALACTIC_CONSTANTS = {
    // ==================== GALAXY GENERATION ====================
    
    /** Minimum number of planets in a galaxy */
    MIN_PLANETS: 5,
    /** Maximum number of planets in a galaxy */
    MAX_PLANETS: 100,
    /** Default number of planets */
    DEFAULT_PLANET_COUNT: 30,
    
    /** Minimum planet volume (determines size and production) */
    PLANET_VOLUME_MIN: 5,
    /** Maximum planet volume */
    PLANET_VOLUME_MAX: 100,
    /** Default volume for medium-sized planets */
    PLANET_VOLUME_DEFAULT: 30,
    
    /** Scale factor for converting volume to visual radius: radius = cbrt(volume) * scale */
    PLANET_RADIUS_SCALE: 5,
    
    /** Minimum distance between planet centers (in units) */
    MIN_PLANET_DISTANCE: 50,
    
    /** Galaxy map dimensions (in units, 1 unit = 1px at scale 1) */
    GALAXY_WIDTH: 1200,
    GALAXY_HEIGHT: 800,
    
    // ==================== RESOURCES AND ECONOMY ====================
    
    /** Resources generated per volume unit per minute */
    RESOURCES_PER_VOLUME_PER_MINUTE: 1,
    
    /** Minimum production rate (resources per volume per minute) */
    PRODUCTION_RATE_MIN: 0.5,
    /** Maximum production rate (resources per volume per minute) */
    PRODUCTION_RATE_MAX: 5,
    /** Default production rate (resources per volume per minute) */
    DEFAULT_PRODUCTION_RATE: 1,
    
    /** Base cost to build one ship */
    SHIP_COST: 10,
    
    /** Resources accumulated every this many milliseconds */
    RESOURCE_TICK_INTERVAL_MS: 60000, // 1 minute
    
    // ==================== ARMADA MOVEMENT ====================
    
    /** Minimum armada speed (units per minute) */
    ARMADA_SPEED_MIN: 10,
    /** Maximum armada speed (units per minute) */
    ARMADA_SPEED_MAX: 1000,
    /** Default armada speed */
    DEFAULT_ARMADA_SPEED: 100,
    
    // ==================== GAME TIMING ====================
    
    /** Minimum game duration in minutes */
    GAME_DURATION_MIN_MINUTES: 1,
    /** Maximum game duration in minutes */
    GAME_DURATION_MAX_MINUTES: 60,
    /** Default game duration */
    DEFAULT_GAME_DURATION_MINUTES: 15,
    
    /** How often to broadcast state updates (configurable range) */
    STATE_BROADCAST_INTERVAL_MIN_MS: 1000,
    STATE_BROADCAST_INTERVAL_MAX_MS: 10000,
    /** Default broadcast interval */
    DEFAULT_STATE_BROADCAST_INTERVAL_MS: 2000,
    
    /** How often to process game events on the server */
    GAME_LOOP_INTERVAL_MS: 500,
    
    /** Delay between battle rounds in milliseconds */
    BATTLE_ROUND_INTERVAL_MS: 500,
    
    // ==================== NEUTRAL PLANETS ====================
    
    /** Minimum defending ships on neutral planets */
    NEUTRAL_SHIPS_MIN: 0,
    /** Minimum multiplier for neutral planet defenders (applied to production) */
    NEUTRAL_SHIPS_MULTIPLIER_MIN: 0,
    /** Maximum multiplier for neutral planet defenders (applied to production) */
    NEUTRAL_SHIPS_MULTIPLIER_MAX: 4,
    
    // ==================== PLAYERS ====================
    
    /** Minimum number of players */
    MIN_PLAYERS: 2,
    /** Maximum number of players */
    MAX_PLAYERS: 20,
    /** Default number of players */
    DEFAULT_PLAYER_COUNT: 4,
    
    // ==================== STARTING CONDITIONS ====================
    
    /** Volume of each player's starting planet */
    STARTING_PLANET_VOLUME: 30,
    /** Ships each player starts with on their home planet */
    STARTING_SHIPS: 10,
    /** Starting resources for each player */
    STARTING_RESOURCES: 0,
    
    // ==================== COMBAT ====================
    
    /** Number of sides on combat dice */
    COMBAT_DICE_SIDES: 6,
    /** Maximum dice attacker can roll */
    MAX_ATTACKER_DICE: 3,
    /** Maximum dice defender can roll */
    MAX_DEFENDER_DICE: 2,
    
    // ==================== UI AND ANIMATIONS ====================
    
    /** Duration for ship movement animations (ms) */
    SHIP_ANIMATION_DURATION_MS: 300,
    /** Duration for battle effect animations (ms) */
    BATTLE_ANIMATION_DURATION_MS: 500,
    /** Duration for planet selection glow (ms) */
    SELECTION_GLOW_DURATION_MS: 200,
    
    // ==================== SPECIAL VALUES ====================
    
    /** Marker for a drawn game */
    DRAWN_GAME: 'DRAWN_GAME' as const,
    /** Label for open player slots */
    OPEN_LABEL: '< open >' as const,
    /** Marker for neutral/unowned */
    NEUTRAL_OWNER: null as null,
    /** Player ID used for neutral planet defenders in battles */
    NEUTRAL_PLAYER_ID: -1,
} as const;

/**
 * Player color palette for up to 20 players
 */
export const PLAYER_COLORS: readonly string[] = [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#0ea5e9', // Sky
    '#84cc16', // Lime
    '#d946ef', // Fuchsia
    '#fbbf24', // Amber
    '#10b981', // Emerald
    '#6366f1', // Indigo
    '#fb923c', // Orange light
    '#2dd4bf', // Teal light
    '#c084fc', // Purple light
] as const;

/** Color for neutral planets */
export const NEUTRAL_COLOR = '#6b7280';

/**
 * AI difficulty levels
 */
export const AI_DIFFICULTIES = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
} as const;

export type AIDifficulty = typeof AI_DIFFICULTIES[keyof typeof AI_DIFFICULTIES];

/**
 * Game status values
 */
export const GAME_STATUS = {
    PENDING: 'PENDING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
} as const;

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

/**
 * Get color for a player by slot index
 */
export function getPlayerColor(slotIndex: number | null): string {
    if (slotIndex === null || slotIndex < 0) {
        return NEUTRAL_COLOR;
    }
    return PLAYER_COLORS[slotIndex % PLAYER_COLORS.length];
}

