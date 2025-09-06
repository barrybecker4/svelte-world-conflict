import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { GameStateData, Player } from '$lib/game/classes/GameState';

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
  const currentTurn = gameState.turnIndex + 1; // Convert to 1-indexed

  // If no turn limit or unlimited turns, game doesn't end by turn limit
  if (!maxTurns || maxTurns === GAME_CONSTANTS.UNLIMITED_TURNS) {
    return {
      isGameEnded: false,
      winner: null,
      reason: null
    };
  }

  // Check if turn limit reached
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
  const activePlayers = players.filter(player => getRegionCount(gameState, player.index) > 0);

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
 * Determine winner based on score (regions + soldiers)
 * Uses same logic as the original game: 1000 * regions + soldiers
 */
function determineWinnerByScore(gameState: GameStateData, players: Player[]): Player | 'DRAWN_GAME' {
  const playerScores = players.map(player => ({
    player,
    score: calculatePlayerScore(gameState, player.index)
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

/**
 * Calculate a player's score: 1000 * regions + total soldiers
 */
function calculatePlayerScore(gameState: GameStateData, playerIndex: number): number {
  const regionCount = getRegionCount(gameState, playerIndex);
  const soldierCount = getTotalSoldiers(gameState, playerIndex);

  return (1000 * regionCount) + soldierCount;
}

/**
 * Get number of regions owned by a player
 */
function getRegionCount(gameState: GameStateData, playerIndex: number): number {
  if (!gameState.ownersByRegion) return 0;
  return Object.values(gameState.ownersByRegion).filter(owner => owner === playerIndex).length;
}

/**
 * Get total number of soldiers owned by a player across all regions
 */
function getTotalSoldiers(gameState: GameStateData, playerIndex: number): number {
  if (!gameState.soldiersByRegion || !gameState.ownersByRegion) return 0;

  let total = 0;
  Object.entries(gameState.soldiersByRegion).forEach(([regionIndexStr, soldiers]) => {
    const regionIndex = parseInt(regionIndexStr);
    if (gameState.ownersByRegion[regionIndex] === playerIndex) {
      total += soldiers.length;
    }
  });

  return total;
}

/**
 * Check if a specific player should be marked as eliminated
 */
export function isPlayerEliminated(gameState: GameStateData, playerIndex: number): boolean {
  return getRegionCount(gameState, playerIndex) === 0;
}

/**
 * Get player statistics for game summary
 */
export function getPlayerStats(gameState: GameStateData, players: Player[]) {
  return players.map(player => ({
    player,
    regionCount: getRegionCount(gameState, player.index),
    soldierCount: getTotalSoldiers(gameState, player.index),
    faithCount: gameState.faithByPlayer[player.index] || 0,
    score: calculatePlayerScore(gameState, player.index),
    isEliminated: isPlayerEliminated(gameState, player.index)
  })).sort((a, b) => b.score - a.score);
}
