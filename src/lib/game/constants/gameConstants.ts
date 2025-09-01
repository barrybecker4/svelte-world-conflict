export const GAME_CONSTANTS = {
    // Grid and map
    GRID_WIDTH: 35,
    GRID_HEIGHT: 25,

    // Turn mechanics
    BASE_MOVES_PER_TURN: 3,
    STANDARD_TURN_COUNT: 10,
    UNLIMITED_TURNS: 999,

    // Time limits (in seconds)
    STANDARD_HUMAN_TIME_LIMIT: 30,
    UNLIMITED_TIME: 0,

    // Game timing
    MOVE_DELAY: 500,
    PLAYBACK_DELAY: 1000,
    AI_THINK_TIME: 2000,

    // Combat
    COMBAT_DICE_SIDES: 6,

    // Starting resources
    STARTING_FAITH: 0,
    OWNER_STARTING_SOLDIERS: 5,
    NEUTRAL_STARTING_SOLDIERS: 2,
    TEMPLE_INCOME_BASE: 10,
    SOLDIER_GENERATION_PER_TEMPLE: 1,

    // Limits
    MAX_TEMPLE_LEVEL: 3,
    MAX_UPGRADE_LEVEL: 3,
    MAX_MOVES_PER_TURN: 3,
    MAX_GAME_TURNS: 100,
    NUM_UPGRADES: 6,
    MAX_PLAYERS: 4,

    // Map generation
    MIN_REGIONS: 15,
    MAX_REGIONS: 25,
    MIN_NEIGHBORS: 2,
    MAX_NEIGHBORS: 6,
    TEMPLE_PROBABILITY: 0.4, // 40% of regions have temples

    // Map sizes
    STANDARD_MAP_SIZE: 'Medium' as const,
    MAP_SIZES: ['Small', 'Medium', 'Large'] as const,

    // Special markers
    DRAWN_GAME: 'DRAWN_GAME' as const,
    OPEN_LABEL: '< open >' as const
} as const;
