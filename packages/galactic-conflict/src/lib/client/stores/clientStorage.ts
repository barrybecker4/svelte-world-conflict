/**
 * Client-side storage utilities for Galactic Conflict
 */

const PLAYER_NAME_KEY = 'gc_player_name';
const GAME_CREATOR_PREFIX = 'gc_creator_';

export interface GameCreatorInfo {
    playerId: string;
    playerSlotIndex: number;
    playerName: string;
}

/**
 * Save player name to local storage
 */
export function savePlayerName(name: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Load player name from local storage
 */
export function loadPlayerName(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(PLAYER_NAME_KEY);
}

/**
 * Save game creator info (for the player who created the game)
 */
export function saveGameCreator(gameId: string, info: GameCreatorInfo): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${GAME_CREATOR_PREFIX}${gameId}`, JSON.stringify(info));
}

/**
 * Load game creator info
 */
export function loadGameCreator(gameId: string): GameCreatorInfo | null {
    if (typeof localStorage === 'undefined') return null;
    const data = localStorage.getItem(`${GAME_CREATOR_PREFIX}${gameId}`);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Clear game creator info
 */
export function clearGameCreator(gameId: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(`${GAME_CREATOR_PREFIX}${gameId}`);
}

