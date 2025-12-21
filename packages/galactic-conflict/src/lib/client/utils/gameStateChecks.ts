import type { GalacticGameStateData } from '$lib/game/entities/gameTypes';

/**
 * Check if the game is completed
 */
export function isGameCompleted(gameState: GalacticGameStateData | null): boolean {
    return gameState?.status === 'COMPLETED';
}

/**
 * Check if a player is eliminated (resigned or defeated)
 */
export function isPlayerEliminated(
    gameState: GalacticGameStateData | null,
    playerId: number | null
): boolean {
    if (playerId === null || !gameState) return false;
    return gameState.eliminatedPlayers?.includes(playerId) ?? false;
}

/**
 * Check if a player can interact with the game (not completed, not eliminated, not resigned)
 */
export function canPlayerInteract(
    gameState: GalacticGameStateData | null,
    playerId: number | null,
    hasResigned: boolean
): boolean {
    if (playerId === null || !gameState || hasResigned) return false;
    if (isGameCompleted(gameState)) return false;
    if (isPlayerEliminated(gameState, playerId)) return false;
    return true;
}

