/**
 * Storage types for Galactic Conflict game persistence
 */
import type { Player, GalacticGameStateData } from '$lib/game/entities/gameTypes';

/** Game record stored in KV storage */
export interface GameRecord {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    players: Player[];
    gameState?: GalacticGameStateData;
    createdAt: number;
    lastUpdateAt: number;
    gameType: 'MULTIPLAYER' | 'AI';
    pendingConfiguration?: {
        playerSlots: Array<{
            slotIndex: number;
            type: 'Open' | 'Set' | 'AI';
            name?: string;
        }>;
        settings?: {
            neutralPlanetCount: number;
            armadaSpeed: number;
            gameDuration: number;
            stateBroadcastInterval: number;
            aiDifficulty?: string;
        };
    };
}

/** Error entry for daily statistics */
export interface StatsError {
    timestamp: number;
    type: string;
    message: string;
    gameId?: string;
}

/** Daily game statistics for reporting */
export interface DailyGameStats {
    date: string;                    // ISO date (YYYY-MM-DD)
    
    // Game counts
    completedGames: number;          // Games that reached endResult
    incompleteGames: number;         // Games abandoned (PENDING->deleted or ACTIVE without completion)
    gamesStarted: number;            // Total games created
    
    // Player metrics
    gamesWithMultipleHumans: number; // Games with 2+ human players
    totalHumanPlayers: number;       // Sum of human players across all games
    totalAiPlayers: number;          // Sum of AI players across all games
    uniquePlayerNames: string[];     // Deduplicated list of human player names (uses Set internally for deduplication)
    
    // Duration/game details (in minutes)
    totalDurationMinutes: number;    // Sum of durations (for average calculation)
    minDurationMinutes: number;      // Shortest game (in minutes)
    maxDurationMinutes: number;      // Longest game (in minutes)
    
    // Outcome breakdown
    endReasons: {
        elimination: number;          // Game ended by elimination (single player remaining)
        timeLimit: number;            // Game ended due to time limit expiring
        resignation: number;         // Game ended due to resignation
    };
    winners: {
        human: number;               // Human player victories
        ai: number;                  // AI victories
        drawn: number;               // Draw outcomes
    };
    
    // Error tracking (use errors.length for count)
    errors: StatsError[];
}

