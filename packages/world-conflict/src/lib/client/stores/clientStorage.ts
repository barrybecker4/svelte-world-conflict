/**
 * World Conflict client storage
 * Uses the framework's createClientStorage factory with game-specific configuration
 */
import { 
    createClientStorage,
    type GameCreatorInfo as BaseGameCreatorInfo,
    type GameConfiguration as BaseGameConfiguration,
    type PlayerSlotConfig,
    type FirstTimeInstructions
} from 'multiplayer-framework/shared';

// Re-export framework types
export type { PlayerSlotConfig, FirstTimeInstructions };

// World Conflict uses the same GameCreatorInfo structure
export type GameCreatorInfo = BaseGameCreatorInfo;

// World Conflict GameConfiguration has required fields
export interface GameConfiguration {
    aiDifficulty: string;
    maxTurns: number;
    timeLimit: number;
    mapSize: string;
    playerSlots: PlayerSlotConfig[];
}

// Create storage instance with World Conflict prefix
const storage = createClientStorage({ prefix: 'wc_' });

// Re-export functions from the storage instance
export function loadPlayerName(): string {
    return storage.loadPlayerName() ?? '';
}

export function savePlayerName(name: string): void {
    storage.savePlayerName(name);
}

export function saveGameCreator(gameId: string, creatorInfo: GameCreatorInfo): void {
    storage.saveGameCreator(gameId, creatorInfo);
}

export function loadGameCreator(gameId: string): GameCreatorInfo | null {
    return storage.loadGameCreator(gameId);
}

export function removeGameCreator(gameId: string): void {
    storage.removeGameCreator(gameId);
}

export function saveGameConfiguration(config: GameConfiguration): void {
    storage.saveGameConfiguration(config);
}

export function loadGameConfiguration(): GameConfiguration | null {
    const config = storage.loadGameConfiguration();
    if (!config) return null;
    
    // Validate the configuration for World Conflict requirements
    if (!isValidConfiguration(config)) {
        console.warn('Invalid stored configuration, ignoring');
        return null;
    }
    
    return config as GameConfiguration;
}

function isValidConfiguration(config: BaseGameConfiguration): config is GameConfiguration {
    if (!config || typeof config !== 'object') {
        return false;
    }
    
    // Check required fields exist
    if (
        typeof config.aiDifficulty !== 'string' ||
        typeof config.maxTurns !== 'number' ||
        typeof config.timeLimit !== 'number' ||
        typeof config.mapSize !== 'string' ||
        !Array.isArray(config.playerSlots)
    ) {
        return false;
    }
    
    // Validate player slots
    if (!config.playerSlots.every((slot) => 
        typeof slot === 'object' &&
        typeof slot.slotIndex === 'number' &&
        typeof slot.type === 'string' &&
        typeof slot.customName === 'string'
    )) {
        return false;
    }
    
    return true;
}

// First-time instructions
export function hasInstructionBeenShown(instructionKey: string): boolean {
    return storage.hasInstructionBeenShown(instructionKey);
}

export function markInstructionAsShown(instructionKey: string): void {
    storage.markInstructionAsShown(instructionKey);
}
