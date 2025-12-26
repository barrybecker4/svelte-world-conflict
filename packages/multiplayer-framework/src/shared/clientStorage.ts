/**
 * Client-side localStorage utilities with configurable prefix
 * Factory function creates game-specific storage helpers
 * 
 * No framework dependencies - works with any JavaScript environment that has localStorage
 */

export interface GameCreatorInfo {
    playerId: string;
    playerSlotIndex: number;
    playerName: string;
}

export interface GameConfiguration {
    aiDifficulty?: string;
    maxTurns?: number;
    timeLimit?: number;
    mapSize?: string;
    playerSlots?: PlayerSlotConfig[];
}

export interface PlayerSlotConfig {
    slotIndex: number;
    type: string;
    customName: string;
}

export interface FirstTimeInstructions {
    [key: string]: boolean;
}

export interface ClientStorageOptions {
    /** Prefix for all storage keys (e.g., 'wc_' for World Conflict, 'gc_' for Galactic Conflict) */
    prefix: string;
}

export interface ClientStorage {
    // Player name
    loadPlayerName(): string | null;
    savePlayerName(name: string): void;
    
    // Game creator info
    saveGameCreator(gameId: string, info: GameCreatorInfo): void;
    loadGameCreator(gameId: string): GameCreatorInfo | null;
    removeGameCreator(gameId: string): void;
    
    // Game configuration
    saveGameConfiguration(config: GameConfiguration): void;
    loadGameConfiguration(): GameConfiguration | null;
    
    // First-time instructions
    hasInstructionBeenShown(instructionKey: string): boolean;
    markInstructionAsShown(instructionKey: string): void;
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
    return typeof localStorage !== 'undefined';
}

/**
 * Create a client storage instance with a specific prefix
 * @param options - Configuration options including the key prefix
 * @returns ClientStorage interface for interacting with localStorage
 */
export function createClientStorage(options: ClientStorageOptions): ClientStorage {
    const { prefix } = options;
    
    const PLAYER_NAME_KEY = `${prefix}player_name`;
    const GAME_PREFIX = `${prefix}game_`;
    const GAME_CONFIG_KEY = `${prefix}game_config`;
    const FIRST_TIME_KEY = `${prefix}first_time_instructions`;

    return {
        loadPlayerName(): string | null {
            if (!isLocalStorageAvailable()) return null;
            return localStorage.getItem(PLAYER_NAME_KEY);
        },

        savePlayerName(name: string): void {
            if (!isLocalStorageAvailable()) return;
            localStorage.setItem(PLAYER_NAME_KEY, name.trim());
        },

        saveGameCreator(gameId: string, info: GameCreatorInfo): void {
            if (!isLocalStorageAvailable()) return;
            localStorage.setItem(`${GAME_PREFIX}${gameId}`, JSON.stringify(info));
        },

        loadGameCreator(gameId: string): GameCreatorInfo | null {
            if (!isLocalStorageAvailable()) return null;
            const data = localStorage.getItem(`${GAME_PREFIX}${gameId}`);
            if (!data) return null;
            try {
                return JSON.parse(data);
            } catch {
                return null;
            }
        },

        removeGameCreator(gameId: string): void {
            if (!isLocalStorageAvailable()) return;
            localStorage.removeItem(`${GAME_PREFIX}${gameId}`);
        },

        saveGameConfiguration(config: GameConfiguration): void {
            if (!isLocalStorageAvailable()) return;
            try {
                localStorage.setItem(GAME_CONFIG_KEY, JSON.stringify(config));
            } catch (e) {
                console.error('Error saving game configuration:', e);
            }
        },

        loadGameConfiguration(): GameConfiguration | null {
            if (!isLocalStorageAvailable()) return null;
            try {
                const stored = localStorage.getItem(GAME_CONFIG_KEY);
                if (!stored) return null;
                return JSON.parse(stored) as GameConfiguration;
            } catch (e) {
                console.error('Error loading game configuration:', e);
                return null;
            }
        },

        hasInstructionBeenShown(instructionKey: string): boolean {
            if (!isLocalStorageAvailable()) return false;
            try {
                const stored = localStorage.getItem(FIRST_TIME_KEY);
                if (!stored) return false;
                const instructions = JSON.parse(stored) as FirstTimeInstructions;
                return instructions[instructionKey] === true;
            } catch {
                return false;
            }
        },

        markInstructionAsShown(instructionKey: string): void {
            if (!isLocalStorageAvailable()) return;
            try {
                const stored = localStorage.getItem(FIRST_TIME_KEY);
                const instructions: FirstTimeInstructions = stored ? JSON.parse(stored) : {};
                instructions[instructionKey] = true;
                localStorage.setItem(FIRST_TIME_KEY, JSON.stringify(instructions));
            } catch (e) {
                console.error('Error saving first-time instructions:', e);
            }
        }
    };
}
