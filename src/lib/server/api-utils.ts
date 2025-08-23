import type { Player } from '$lib/game/GameState.ts';

// Update with your deployed worker URL. i.e. replace "barrybecker4", with your username, if needed.
export const WORKER_URL = 'https://svelte-world-conflict-websocket.barrybecker4.workers.dev';

/**
 * Helper function to safely get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Generate a unique game ID
 */
export function generateGameId(): string {
    return `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique player ID (though WC uses index, this can be useful for tracking)
 */
export function generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


/**
 * Create a properly typed World Conflict Player object
 */
export function createPlayer(name: string, index: number, isAI: boolean = false): Player {
    if (index < 0 || index > 3) {
        throw new Error(`Invalid player index: ${index}. Must be 0-3.`);
    }

    return {
        index,
        name: name.trim(),
        isAI
    };
}

/**
 * Create multiple AI players for a game
 */
export function createAIPlayers(startIndex: number = 1): Player[] {
    const aiNames = ['AI Warrior', 'AI Strategist', 'AI Commander'];
    const players: Player[] = [];

    for (let i = 0; i < Math.min(3, aiNames.length); i++) {
        const playerIndex = startIndex + i;
        if (playerIndex <= 3) {
            players.push(createPlayer(aiNames[i], playerIndex, true));
        }
    }

    return players;
}

/**
 * Validate player name
 */
export function validatePlayerName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Player name is required' };
    }

    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Player name cannot be empty' };
    }

    if (trimmed.length > 50) {
        return { valid: false, error: 'Player name must be 50 characters or less' };
    }

    if (trimmed.length < 2) {
        return { valid: false, error: 'Player name must be at least 2 characters' };
    }

    // Check for invalid characters (optional - adjust as needed)
    const invalidChars = /[<>\"'&]/;
    if (invalidChars.test(trimmed)) {
        return { valid: false, error: 'Player name contains invalid characters' };
    }

    return { valid: true };
}

/**
 * Convert a playerId string to player index for World Conflict
 * This handles the case where APIs might pass player IDs but WC uses indices
 */
export function parsePlayerIndex(playerId: string): number | null {
    // Try to parse as integer first
    const parsed = parseInt(playerId);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) {
        return parsed;
    }

    // If that fails, could implement other parsing logic here
    // For now, return null to indicate invalid
    return null;
}

/**
 * Check if a game is considered stale/expired
 */
export function isGameStale(gameCreatedAt: number, maxAgeMinutes: number = 30): boolean {
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    return Date.now() - gameCreatedAt > maxAge;
}

/**
 * Format game status for client display
 */
export function formatGameStatus(status: string, playerCount: number, maxPlayers: number = 4): string {
    switch (status) {
        case 'PENDING':
            return `Waiting for players (${playerCount}/${maxPlayers})`;
        case 'ACTIVE':
            return 'Game in progress';
        case 'COMPLETED':
            return 'Game finished';
        default:
            return status;
    }
}

/**
 * Sanitize game data for client response (remove sensitive info)
 */
export function sanitizeGameForClient(game: any) {
    return {
        gameId: game.gameId,
        status: game.status,
        playerCount: game.players?.length || 0,
        players: game.players?.map((p: Player) => ({
            name: p.name,
            index: p.index,
            color: p.color,
            isAI: p.isAI
        })) || [],
        createdAt: game.createdAt,
        lastMoveAt: game.lastMoveAt
    };
}
