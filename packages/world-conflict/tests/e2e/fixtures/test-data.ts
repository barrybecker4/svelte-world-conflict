/**
 * Test data and constants for e2e tests
 */

export const TEST_PLAYERS = {
  PLAYER1: 'TestPlayer1',
  PLAYER2: 'TestPlayer2',
  PLAYER3: 'TestPlayer3',
  PLAYER4: 'TestPlayer4',
};

/**
 * Default AI player names from playerConfigs.ts
 * These are the names shown when slots are set to AI
 */
export const AI_PLAYER_NAMES = {
  SLOT_0: 'Emerald',
  SLOT_1: 'Crimson',
  SLOT_2: 'Amber',
  SLOT_3: 'Lavender',
};

export const GAME_SETTINGS = {
  DEFAULT: {
    mapSize: 'Small',
    aiDifficulty: 'Nice',
    maxTurns: 50,
    timeLimit: 120,
  },
  QUICK: {
    mapSize: 'Small',
    aiDifficulty: 'Nice',
    maxTurns: 10,
    timeLimit: 60,
  },
};

export const SLOT_TYPES = {
  SET: 'Set',    // Human player (current player)
  OPEN: 'Open',  // Open for another human
  AI: 'AI',      // AI player
  OFF: 'Off',    // Inactive slot
};

export const TIMEOUTS = {
  GAME_LOAD: 10000,
  AI_TURN: 30000,
  TURN_TRANSITION: 5000,
  ELEMENT_LOAD: 5000,
};

