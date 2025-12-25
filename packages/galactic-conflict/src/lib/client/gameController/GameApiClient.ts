/**
 * API client for Galactic Conflict game actions
 */

import type { CreateGameRequest, CreateGameResponse, JoinGameResponse } from '$lib/game/entities/gameTypes';

interface ApiErrorResponse {
    error?: string;
}

/**
 * Retry a fetch operation with exponential backoff for version conflicts (409).
 * This handles cases where the server is busy with event processing.
 */
async function fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const response = await fetch(url, options);
        
        // If success or non-retryable error, return immediately
        if (response.ok || response.status !== 409) {
            return response;
        }
        
        // 409 = version conflict, retry with backoff
        if (attempt < maxRetries - 1) {
            const baseDelay = 100;
            const exponentialDelay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, exponentialDelay + jitter));
            lastError = new Error('Version conflict, retrying...');
            continue;
        }
        
        // Last attempt also failed
        return response;
    }
    
    // Should not reach here, but TypeScript needs this
    throw lastError || new Error('Fetch failed');
}

export class GameApiClient {
    /**
     * Create a new game
     */
    static async createGame(request: Partial<CreateGameRequest>): Promise<CreateGameResponse> {
        const response = await fetch('/api/game/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to create game');
        }

        return response.json();
    }

    /**
     * Get game state
     */
    static async getGame(gameId: string): Promise<any> {
        const response = await fetch(`/api/game/${gameId}`);

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to get game');
        }

        return response.json();
    }

    /**
     * Join a pending game
     */
    static async joinGame(gameId: string, playerName: string, slotIndex: number): Promise<JoinGameResponse> {
        const response = await fetch(`/api/game/${gameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, slotIndex }),
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to join game');
        }

        return response.json();
    }

    /**
     * Start a pending game
     */
    static async startGame(gameId: string): Promise<any> {
        const response = await fetch(`/api/game/${gameId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to start game');
        }

        return response.json();
    }

    /**
     * Send an armada from one planet to another.
     * Uses client-side retry for version conflicts (409).
     */
    static async sendArmada(
        gameId: string,
        playerId: number,
        sourcePlanetId: number,
        destinationPlanetId: number,
        shipCount: number
    ): Promise<any> {
        const response = await fetchWithRetry(
            `/api/game/${gameId}/send-armada`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    sourcePlanetId,
                    destinationPlanetId,
                    shipCount,
                }),
            },
            3 // Client retries in addition to server retries
        );

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to send armada');
        }

        return response.json();
    }

    /**
     * Build ships at a planet.
     * Uses client-side retry for version conflicts (409).
     */
    static async buildShips(
        gameId: string,
        playerId: number,
        planetId: number,
        shipCount: number
    ): Promise<any> {
        const response = await fetchWithRetry(
            `/api/game/${gameId}/build-ships`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    planetId,
                    shipCount,
                }),
            },
            3 // Client retries in addition to server retries
        );

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to build ships');
        }

        return response.json();
    }

    /**
     * Get list of open games
     */
    static async getOpenGames(): Promise<any> {
        const response = await fetch('/api/games/open');

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to get open games');
        }

        return response.json();
    }

    /**
     * Resign from the game
     */
    static async resign(gameId: string, playerId: number): Promise<any> {
        const response = await fetch(`/api/game/${gameId}/resign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to resign');
        }

        return response.json();
    }

    /**
     * Trigger event processing on the server.
     */
    static async processEvents(): Promise<any> {
        const response = await fetch('/api/admin/process-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to process events');
        }

        return response.json();
    }
}

