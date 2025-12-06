import { turnTimerStore } from '$lib/client/stores/turnTimerStore';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { GameStateData } from '$lib/game/entities/gameTypes';

/**
 * Coordinates turn timer management
 */
export class TurnTimerCoordinator {
  private readonly playerSlotIndex: number;
  private onTimerExpired: () => void;

  constructor(playerId: string, onTimerExpired: () => void) {
    this.playerSlotIndex = parseInt(playerId);
    this.onTimerExpired = onTimerExpired;
  }

  /**
   * Start or stop the turn timer based on game state
   */
  handleTurnChange(gameState: GameStateData): void {
    turnTimerStore.stopTimer();

    // Don't start timer if game has ended
    const endResult = checkGameEnd(gameState, gameState.players);
    if (endResult.isGameEnded) return;

    // Don't start timer if player has been eliminated (e.g., resigned and is now spectating)
    const eliminatedPlayers = gameState.eliminatedPlayers || [];
    if (eliminatedPlayers.includes(this.playerSlotIndex)) return;

    const isMyTurn = gameState.currentPlayerSlot === this.playerSlotIndex;
    const isHumanPlayer = gameState.players.some(p =>
      p.slotIndex === this.playerSlotIndex && !p.isAI
    );
    const timeLimit = gameState.moveTimeLimit || GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;
    const isUnlimitedTime = timeLimit === GAME_CONSTANTS.UNLIMITED_TIME;

    if (isMyTurn && isHumanPlayer && timeLimit && !isUnlimitedTime) {
      turnTimerStore.startTimer(timeLimit, this.onTimerExpired);
    }
  }

  /**
   * Stop the turn timer
   */
  stopTimer(): void {
    turnTimerStore.stopTimer();
  }
}
