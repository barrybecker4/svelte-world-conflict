/**
 * Utility functions for detecting changes in game state
 */

import type { GalacticGameState } from '$lib/game/state/GalacticGameState';
import { compareEndResult } from './compareEndResult';

export interface GameStateSnapshot {
    replays: number;
    reinforcements: number;
    conquests: number;
    eliminations: number;
    armadas: number;
    status: string;
    endResult: unknown;
    lastUpdateTime: number;
}

/**
 * Capture a snapshot of game state before processing
 */
export function captureGameStateBefore(gameState: GalacticGameState): GameStateSnapshot {
    return {
        replays: gameState.recentBattleReplays.length,
        reinforcements: gameState.recentReinforcementEvents.length,
        conquests: gameState.recentConquestEvents.length,
        eliminations: gameState.recentPlayerEliminationEvents.length,
        armadas: gameState.armadas.length,
        status: gameState.state.status,
        endResult: gameState.state.endResult,
        lastUpdateTime: gameState.state.lastUpdateTime,
    };
}

/**
 * Capture a snapshot of game state after processing
 */
export function captureGameStateAfter(gameState: GalacticGameState): GameStateSnapshot {
    return captureGameStateBefore(gameState);
}

/**
 * Detect if game state has changed between before and after snapshots
 */
export function detectGameStateChanges(before: GameStateSnapshot, after: GameStateSnapshot): boolean {
    // Consider it changed if:
    // - Battle replays were added
    // - Reinforcement, conquest, or elimination events were added
    // - Armadas changed (arrived or removed)
    // - Status changed (game ended)
    // - endResult changed (game ended with winner determined)
    // - lastUpdateTime changed (events were processed, even if just resource ticks)
    return after.replays > before.replays || 
           after.reinforcements > before.reinforcements ||
           after.conquests > before.conquests ||
           after.eliminations > before.eliminations ||
           after.armadas !== before.armadas || 
           after.status !== before.status ||
           compareEndResult(before.endResult, after.endResult) ||
           after.lastUpdateTime !== before.lastUpdateTime;
}

