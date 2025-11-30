import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { GameStateData, Player } from '$lib/game/entities/gameTypes';
import { ScoreCalculator } from '$lib/game/mechanics/ScoreCalculator';

export interface GameEndResult {
  isGameEnded: boolean;
  winner: Player | 'DRAWN_GAME' | null;
  reason: 'TURN_LIMIT' | 'ELIMINATION' | 'RESIGNATION' | null;
}

/**
 * Check if the game should end and determine the winner
 */
export function checkGameEnd(gameState: GameStateData, players: Player[]): GameEndResult {
  // Check turn limit first
  const turnLimitResult = checkTurnLimit(gameState, players);
  if (turnLimitResult.isGameEnded) {
    return turnLimitResult;
  }

  // Check elimination
  const eliminationResult = checkElimination(gameState, players);
  if (eliminationResult.isGameEnded) {
    return eliminationResult;
  }

  return {
    isGameEnded: false,
    winner: null,
    reason: null
  };
}

/**
 * Check if turn limit has been reached
 */
function checkTurnLimit(gameState: GameStateData, players: Player[]): GameEndResult {
  const maxTurns = gameState.maxTurns;
  const currentTurn = gameState.turnNumber + 1; // Convert to 1-indexed

  // If no turn limit or unlimited turns, game doesn't end by turn limit
  if (!maxTurns || maxTurns === GAME_CONSTANTS.UNLIMITED_TURNS) {
    return {
      isGameEnded: false,
      winner: null,
      reason: null
    };
  }

  // Check if turn limit reached
  // Use >= because checkGameEnd is called BEFORE turnNumber is incremented
  // After round N completes, turnNumber is still N-1, so currentTurn = N
  if (currentTurn >= maxTurns) {
    const winner = determineWinnerByScore(gameState, players);
    return {
      isGameEnded: true,
      winner,
      reason: 'TURN_LIMIT'
    };
  }

  return {
    isGameEnded: false,
    winner: null,
    reason: null
  };
}

/**
 * Check if all but one player has been eliminated
 */
function checkElimination(gameState: GameStateData, players: Player[]): GameEndResult {
  const scoreCalculator = new ScoreCalculator(gameState);
  const activePlayers = players.filter(player => scoreCalculator.getRegionCount(player.slotIndex) > 0);

  if (activePlayers.length <= 1) {
    const winner = activePlayers.length === 1 ? activePlayers[0] : 'DRAWN_GAME';
    return {
      isGameEnded: true,
      winner,
      reason: 'ELIMINATION'
    };
  }

  return {
    isGameEnded: false,
    winner: null,
    reason: null
  };
}

/**
 * Determine winner based on score
 */
function determineWinnerByScore(gameState: GameStateData, players: Player[]): Player | 'DRAWN_GAME' {
  const scoreCalculator = new ScoreCalculator(gameState);
  const playerScores = players.map(player => ({
    player,
    score: scoreCalculator.calculatePlayerScore(player.slotIndex),
  }));

  // Sort by score descending
  playerScores.sort((a, b) => b.score - a.score);

  // Check for tie between top players
  const topScore = playerScores[0].score;
  const topPlayers = playerScores.filter(p => p.score === topScore);

  if (topPlayers.length > 1) {
    return 'DRAWN_GAME';
  }

  return playerScores[0].player;
}
