/**
 * Test data and constants for e2e tests
 */

export const TEST_PLAYERS = {
    PLAYER1: 'TestPlayer1',
    PLAYER2: 'TestPlayer2',
    PLAYER3: 'TestPlayer3',
    PLAYER4: 'TestPlayer4'
};

/**
 * Default AI player names from playerConfigs.ts
 * These are the names shown when slots are set to AI
 */
export const AI_PLAYER_NAMES = {
    SLOT_0: 'Emerald',
    SLOT_1: 'Crimson',
    SLOT_2: 'Amber',
    SLOT_3: 'Lavender'
};

export const GAME_SETTINGS = {
    DEFAULT: {
        mapSize: 'Small',
        aiDifficulty: 'Nice',
        maxTurns: 50,
        timeLimit: 120
    },
    QUICK: {
        mapSize: 'Medium', // Medium has enough temples for 4 players
        aiDifficulty: 'Nice',
        maxTurns: 10,
        timeLimit: 60
    }
};

export const SLOT_TYPES = {
    SET: 'Set', // Human player (current player)
    OPEN: 'Open', // Open for another human
    AI: 'AI', // AI player
    OFF: 'Off' // Inactive slot
} as const;

export const TIMEOUTS = {
    GAME_LOAD: 10000,
    AI_TURN: 30000,
    TURN_TRANSITION: 5000,
    ELEMENT_LOAD: 5000
};

export const WAITING_ROOM_TIMEOUTS = {
    PLAYER_JOIN: 5000, // Wait for player to join
    WEBSOCKET_UPDATE: 3000, // Wait for WebSocket propagation
    START_BUTTON: 2000 // Wait for start button to enable
};

export const TEST_SCENARIOS = {
    TWO_HUMANS_ADJACENT: {
        description: 'Two humans in slots 0-1',
        slots: [
            { type: 'Set', player: 'PLAYER1' },
            { type: 'Open', player: 'PLAYER2' },
            { type: 'Off', player: null },
            { type: 'Off', player: null }
        ]
    },
    TWO_HUMANS_CREATOR_LAST: {
        description: 'Two humans, creator in last slot',
        slots: [
            { type: 'Open', player: 'PLAYER2' },
            { type: 'Open', player: null },
            { type: 'Open', player: null },
            { type: 'Set', player: 'PLAYER1' }
        ]
    },
    THREE_HUMANS_WITH_GAP: {
        description: 'Three humans with slot 1 off',
        slots: [
            { type: 'Set', player: 'PLAYER1' },
            { type: 'Off', player: null },
            { type: 'Open', player: 'PLAYER2' },
            { type: 'Open', player: 'PLAYER3' }
        ]
    },
    FOUR_HUMANS_FULL: {
        description: 'Four humans, all slots filled',
        slots: [
            { type: 'Set', player: 'PLAYER1' },
            { type: 'Open', player: 'PLAYER2' },
            { type: 'Open', player: 'PLAYER3' },
            { type: 'Open', player: 'PLAYER4' }
        ]
    },
    MIXED_HUMAN_AI: {
        description: 'Mixed human and AI',
        slots: [
            { type: 'Open', player: 'PLAYER2' },
            { type: 'Off', player: null },
            { type: 'Set', player: 'PLAYER1' },
            { type: 'AI', player: 'AI' }
        ]
    }
};
