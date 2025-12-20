const STANDARD_HUMAN_TIME_LIMIT = 30;
const UNLIMITED_TIME = 3600;
const STANDARD_MAX_TURNS = 10;

export const GAME_CONSTANTS = {
    // Grid and map
    GRID_WIDTH: 35,
    GRID_HEIGHT: 25,

    // Turn mechanics
    BASE_MOVES_PER_TURN: 3,
    STANDARD_MAX_TURNS,
    MAX_TURN_OPTIONS: [3, STANDARD_MAX_TURNS, 15],
    DEFAULT_TURN_COUNT_INDEX: 1,
    UNLIMITED_TURNS: 999,

    // Time limits (in seconds)
    STANDARD_HUMAN_TIME_LIMIT,
    UNLIMITED_TIME,
    TIME_LIMITS: [10, STANDARD_HUMAN_TIME_LIMIT, 60, UNLIMITED_TIME] as const,

    // Game timing
    MOVE_DELAY: 500,
    PLAYBACK_DELAY: 500,
    AI_THINK_TIME: 100, // Reduced for Cloudflare Workers CPU time limits
    BANNER_TIME: 2000,

    // Animation timing (milliseconds)
    SOLDIER_MOVE_ANIMATION_MS: 500, // Soldier movement transition duration
    QUICK_ANIMATION_MS: 300, // Short animations and delays
    FEEDBACK_HIGHLIGHT_MS: 1000, // Visual feedback highlight duration
    BATTLE_END_WAIT_MS: 500, // Wait time after battle ends
    SMOKE_WAIT_MS: 0, // Wait for smoke effects to complete

    // Smoke effects
    SMOKE_DURATION_MS: 500, // Smoke particle lifetime
    SMOKE_PARTICLE_COUNT: 10, // Default particles per smoke spawn

    // Timer/Warning
    TIMER_WARNING_SECONDS: 10, // Time remaining threshold for warnings
    TIMER_TICK_INTERVAL_MS: 1000, // Timer countdown interval
    TIMER_GLOW_DURATION_MS: 300, // Timer visual glow duration

    // Network/Polling (milliseconds)
    ERROR_MESSAGE_TIMEOUT_MS: 3000, // Auto-dismiss error messages
    LOBBY_POLL_INTERVAL_MS: 10000, // Lobby refresh interval

    // Game lifecycle
    // Timeout for stale open games (30 minutes) - games not joined within this time are removed
    STALE_GAME_TIMEOUT_MS: 30 * 60 * 1000,

    // Battle/Combat timing
    BATTLE_TIMEOUT_MS: 3000, // Default battle timeout to prevent stuck battles

    // UI Layout
    SIDE_PANEL_WIDTH: 400, // Width in pixels for GameInfoPanel and GameSummaryPanel
    PLAYER_NAME_MAX_WIDTH: 130, // Max width in pixels for player names with ellipsis

    // AI Processing
    AI_ACTION_DELAY_MS: 100, // Delay between AI actions for UX
    MAX_AI_TURNS: 50, // Safety limit to prevent infinite loops

    // Army Display
    MAX_INDIVIDUAL_ARMIES: 16, // Threshold for showing individual army markers
    ARMIES_PER_ROW: 8, // Grid layout for army positioning
    ARMY_OFFSET_X: 4, // Horizontal spacing between armies
    ARMY_OFFSET_Y: 3, // Vertical spacing between army rows
    TEMPLE_ARMY_OFFSET_Y: 15, // Additional Y offset when temple present

    // Audio System (milliseconds)
    AUDIO_WARNING_REPEAT_MS: 500, // Interval for repeating time warnings
    AUDIO_WARNING_DURATION_MS: 3000, // Default warning sound duration

    // Combat
    COMBAT_DICE_SIDES: 6,
    FAITH_PER_DEFENDER_DEATH: 1,  // Faith to defender per soldier lost defending
    FAITH_PER_DEFENDER_KILLED: 1, // Faith to attacker per defender killed

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
