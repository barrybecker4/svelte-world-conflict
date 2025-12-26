import type { GameStateData, PendingGameData, PlayerSlot } from '$lib/game/entities/gameTypes';

// ============================================================================
// Response Types
// ============================================================================

export interface EndTurnResponse {
    success?: boolean;
    gameState?: GameStateData;
    message?: string;
}

export interface ResignResponse {
    gameEnded?: boolean;
}

export interface PurchaseUpgradeResponse {
    gameState?: GameStateData;
}

export interface BattleMove {
    sourceRegionIndex: number;
    targetRegionIndex: number;
    soldierCount: number;
    gameState: GameStateData;
}

export interface BattleResult {
    success: boolean;
    gameState?: GameStateData;
    attackSequence?: any[];
    error?: string;
}

export interface GameStateResponse {
    worldConflictState?: GameStateData;
    status?: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    gameId?: string;
    players?: Array<{ slotIndex: number; name: string }>;
    pendingConfiguration?: {
        playerSlots: PlayerSlot[];
    };
}

export interface CreateGameConfig {
    playerName: string;
    gameType?: string;
    mapSize?: string;
    aiDifficulty?: string;
    maxTurns?: number;
    timeLimit?: number;
    playerSlots?: PlayerSlot[];
    selectedMapRegions?: any[];
    selectedMapState?: any;
    settings?: any;
}

export interface CreateGameResponse {
    gameId: string;
    player: {
        slotIndex: number;
        name: string;
    };
    playerSlotIndex: number;
    gameState?: GameStateData;
    message?: string;
}

export interface OpenGame {
    gameId: string;
    creator: string;
    playerCount: number;
    maxPlayers: number;
    createdAt: number;
    gameType: string;
    timeRemaining: number;
    pendingConfiguration?: {
        playerSlots: PlayerSlot[];
    };
    players: Array<{ slotIndex: number; name: string }>;
}

export interface JoinGameResponse {
    player: {
        name: string;
        slotIndex: number;
        isAI: boolean;
    };
}

export interface StartGameResponse {
    success: boolean;
    gameState?: GameStateData;
}

export interface LeaveGameResponse {
    success: boolean;
}

/**
 * Client for making API calls to the game server.
 *
 * Instance methods require a gameId (for game-specific operations).
 * Static methods are for global operations (creating games, listing open games).
 */
export class GameApiClient {
    constructor(private gameId: string) {}

    /**
     * Handle API response - throws on error, returns JSON on success
     */
    private async handleResponse<T>(response: Response, operation: string): Promise<T> {
        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
                error?: string;
            };
            throw new Error(errorData.error || `Failed to ${operation}`);
        }
        return response.json() as Promise<T>;
    }

    /**
     * Static version of handleResponse for static methods
     */
    private static async handleResponseStatic<T>(response: Response, operation: string): Promise<T> {
        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
                error?: string;
            };
            throw new Error(errorData.error || `Failed to ${operation}`);
        }
        return response.json() as Promise<T>;
    }

    // ==========================================================================
    // Static Methods (Global Operations)
    // ==========================================================================

    /**
     * Create a new game
     */
    static async createGame(config: CreateGameConfig): Promise<CreateGameResponse> {
        const response = await fetch('/api/game/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: config.playerName,
                gameType: config.gameType || 'MULTIPLAYER',
                mapSize: config.mapSize,
                aiDifficulty: config.aiDifficulty,
                maxTurns: config.maxTurns,
                timeLimit: config.timeLimit,
                playerSlots: config.playerSlots,
                selectedMapRegions: config.selectedMapRegions,
                selectedMapState: config.selectedMapState,
                settings: config.settings
            })
        });

        return this.handleResponseStatic<CreateGameResponse>(response, 'create game');
    }

    /**
     * List all open games in the lobby
     */
    static async listOpenGames(): Promise<OpenGame[]> {
        const response = await fetch('/api/games/open');
        return this.handleResponseStatic<OpenGame[]>(response, 'load open games');
    }

    // ==========================================================================
    // Instance Methods (Game-Specific Operations)
    // ==========================================================================

    /**
     * Get the current game state
     */
    async getGameState(): Promise<GameStateResponse> {
        const response = await fetch(`/api/game/${this.gameId}`);
        return this.handleResponse<GameStateResponse>(response, 'load game state');
    }

    /**
     * Join a game in a specific slot
     */
    async joinGame(playerName: string, preferredSlot: number): Promise<JoinGameResponse> {
        const response = await fetch(`/api/game/${this.gameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerName, preferredSlot })
        });

        return this.handleResponse<JoinGameResponse>(response, 'join game');
    }

    /**
     * Start a pending game (host only)
     */
    async startGame(): Promise<StartGameResponse> {
        const response = await fetch(`/api/game/${this.gameId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        return this.handleResponse<StartGameResponse>(response, 'start game');
    }

    /**
     * Leave a game (from waiting room)
     */
    async leaveGame(playerId: string): Promise<LeaveGameResponse> {
        const response = await fetch(`/api/game/${this.gameId}/quit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });

        return this.handleResponse<LeaveGameResponse>(response, 'leave game');
    }

    /**
     * End the current player's turn
     */
    async endTurn(playerId: string, pendingMoves?: any[]): Promise<EndTurnResponse> {
        const response = await fetch(`/api/game/${this.gameId}/end-turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                moves: pendingMoves || []
            })
        });

        return this.handleResponse<EndTurnResponse>(response, 'end turn');
    }

    /**
     * Resign from the game (during active gameplay)
     */
    async resign(playerId: string): Promise<ResignResponse> {
        const response = await fetch(`/api/game/${this.gameId}/quit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId,
                reason: 'RESIGN'
            })
        });

        return this.handleResponse<ResignResponse>(response, 'resign from game');
    }

    /**
     * Trigger AI turn processing on the server
     */
    async triggerAiProcessing(): Promise<void> {
        const response = await fetch(`/api/game/${this.gameId}/process-ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as {
                error?: string;
            };
            throw new Error(errorData.error || 'Failed to trigger AI processing');
        }
    }
}
