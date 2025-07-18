/**
 * Validation utilities for API endpoints
 */
export type ValidationResult<T> =
    | { success: true; data: T; error?: never }
    | { success: false; data?: never; error: string }

/**
 * Validate create game request
 */
export function validateCreateGameRequest(data: unknown): ValidationResult<{
    playerName: string;
    gameType: 'MULTIPLAYER' | 'AI';
}> {
    if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid request body' };
    }

    const body = data as Record<string, unknown>;

    if (!body.playerName || typeof body.playerName !== 'string') {
        return { success: false, error: 'Player name is required and must be a string' };
    }

    if (body.playerName.trim().length === 0) {
        return { success: false, error: 'Player name cannot be empty' };
    }

    if (body.playerName.length > 50) {
        return { success: false, error: 'Player name must be 50 characters or less' };
    }

    const gameType = body.gameType === 'AI' ? 'AI' : 'MULTIPLAYER';

    return {
        success: true,
        data: {
            playerName: body.playerName.trim(),
            gameType
        }
    };
}

/**
 * Validate join game request
 */
export function validateJoinGameRequest(data: unknown): ValidationResult<{
    playerName: string;
}> {
    if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid request body' };
    }

    const body = data as Record<string, unknown>;

    if (!body.playerName || typeof body.playerName !== 'string') {
        return { success: false, error: 'Player name is required and must be a string' };
    }

    if (body.playerName.trim().length === 0) {
        return { success: false, error: 'Player name cannot be empty' };
    }

    if (body.playerName.length > 50) {
        return { success: false, error: 'Player name must be 50 characters or less' };
    }

    return {
        success: true,
        data: {
            playerName: body.playerName.trim()
        }
    };
}

/**
 * Validate move request
 */
export function validateMoveRequest(data: unknown): ValidationResult<{
    playerId: string;
    move: {
        type: string;
        [key: string]: any;
    };
}> {
    if (!data || typeof data !== 'object') {
        return { success: false, error: 'Invalid request body' };
    }

    const body = data as Record<string, unknown>;

    if (!body.playerId || typeof body.playerId !== 'string') {
        return { success: false, error: 'Player ID is required and must be a string' };
    }

    if (!body.move || typeof body.move !== 'object') {
        return { success: false, error: 'Move is required and must be an object' };
    }

    const move = body.move as Record<string, unknown>;

    if (!move.type || typeof move.type !== 'string') {
        return { success: false, error: 'Move type is required and must be a string' };
    }

    return {
        success: true,
        data: {
            playerId: body.playerId,
            move: move as { type: string; [key: string]: any }
        }
    };
}

/**
 * Validate game ID parameter
 */
export function validateGameId(gameId: string): ValidationResult<string> {
    if (!gameId) {
        return { success: false, error: 'Game ID is required' };
    }

    // Basic UUID validation (you can make this more strict)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(gameId)) {
        return { success: false, error: 'Invalid game ID format' };
    }

    return {
        success: true,
        data: gameId
    };
}
