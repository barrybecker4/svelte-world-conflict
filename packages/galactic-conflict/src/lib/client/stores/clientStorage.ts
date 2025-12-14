/**
 * Galactic Conflict client storage
 * Uses the framework's createClientStorage factory with game-specific configuration
 */
import { 
    createClientStorage,
    type GameCreatorInfo as BaseGameCreatorInfo
} from 'multiplayer-framework/shared';

// Galactic Conflict uses the same GameCreatorInfo structure
export type GameCreatorInfo = BaseGameCreatorInfo;

// Create storage instance with Galactic Conflict prefix
const storage = createClientStorage({ prefix: 'gc_' });

// Re-export functions from the storage instance
export function loadPlayerName(): string | null {
    return storage.loadPlayerName();
}

export function savePlayerName(name: string): void {
    storage.savePlayerName(name);
}

export function saveGameCreator(gameId: string, info: GameCreatorInfo): void {
    storage.saveGameCreator(gameId, info);
}

export function loadGameCreator(gameId: string): GameCreatorInfo | null {
    return storage.loadGameCreator(gameId);
}

// Galactic Conflict uses "clearGameCreator" instead of "removeGameCreator"
export function clearGameCreator(gameId: string): void {
    storage.removeGameCreator(gameId);
}
