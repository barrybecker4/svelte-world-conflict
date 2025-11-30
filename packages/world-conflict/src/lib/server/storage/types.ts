/**
 * Storage types for World Conflict game persistence
 */
import type { Player, GameStateData } from '$lib/game/state/GameState';
import type { PlayerSlotType } from '$lib/game/entities/PlayerSlot';

/** Metadata about a move for client animation */
export interface MoveMetadata {
    type: 'army_move' | 'recruit' | 'upgrade' | 'end_turn';
    sourceRegion?: number;
    targetRegion?: number;
    soldierCount?: number;
    /** Attack sequence for this specific move (for battles) */
    attackSequence?: unknown[];
}

/** Game record stored in KV storage */
export interface GameRecord {
    gameId: string;
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
    players: Player[];
    worldConflictState: GameStateData;
    createdAt: number;
    lastMoveAt: number;
    currentPlayerSlot: number;
    gameType: 'MULTIPLAYER' | 'AI';
    /** Attack sequence from the last move for battle replay */
    lastAttackSequence?: unknown[];
    /** Metadata about the last move for animation */
    lastMove?: MoveMetadata;
    /** All moves executed in the turn for sequential replay */
    turnMoves?: MoveMetadata[];

    /** Optional configuration for PENDING games that need to be completed */
    pendingConfiguration?: {
        playerSlots: Array<{
            slotIndex: number;
            type: PlayerSlotType;
            name: string;
            customName?: string;
        }>;
        settings?: {
            mapSize: string;
            aiDifficulty: string;
            maxTurns?: number;
            timeLimit?: number;
        };
        /** @deprecated Use settings instead */
        mapSize?: string;
        /** @deprecated Use settings instead */
        aiDifficulty?: string;
    };
}

/** Summary info for listing open games */
export interface OpenGameInfo {
    gameId: string;
    status: string;
    createdAt: number;
    playerCount: number;
    maxPlayers: number;
    gameType: 'MULTIPLAYER' | 'AI';
}

/** List of open games for matchmaking */
export interface OpenGamesList {
    games: OpenGameInfo[];
    lastUpdated: number;
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
    
    // Turn/game details
    totalTurns: number;              // Sum of turns (for average calculation)
    minTurns: number;                // Shortest game
    maxTurns: number;                // Longest game
    
    // Outcome breakdown
    endReasons: {
        elimination: number;
        turnLimit: number;
        resignation: number;
    };
    winners: {
        human: number;               // Human player victories
        ai: number;                  // AI victories
        drawn: number;               // Draw outcomes
    };
    
    // Error tracking (use errors.length for count)
    errors: StatsError[];
}

