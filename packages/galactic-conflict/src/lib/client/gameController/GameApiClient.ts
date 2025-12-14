/**
 * API client for Galactic Conflict game actions
 */

import type { CreateGameRequest, CreateGameResponse, JoinGameResponse } from '$lib/game/entities/gameTypes';

interface ApiErrorResponse {
    error?: string;
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
     * Send an armada from one planet to another
     */
    static async sendArmada(
        gameId: string,
        playerId: number,
        sourcePlanetId: number,
        destinationPlanetId: number,
        shipCount: number
    ): Promise<any> {
        const response = await fetch(`/api/game/${gameId}/send-armada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                sourcePlanetId,
                destinationPlanetId,
                shipCount,
            }),
        });

        if (!response.ok) {
            const error: ApiErrorResponse = await response.json();
            throw new Error(error.error || 'Failed to send armada');
        }

        return response.json();
    }

    /**
     * Build ships at a planet
     */
    static async buildShips(
        gameId: string,
        playerId: number,
        planetId: number,
        shipCount: number
    ): Promise<any> {
        const response = await fetch(`/api/game/${gameId}/build-ships`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                planetId,
                shipCount,
            }),
        });

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
}

