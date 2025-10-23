import { turnTimerStore } from '$lib/client/stores/turnTimerStore';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { GameStateData } from '$lib/game/entities/gameTypes';

/**
 * Coordinates turn timer management
 * Extracted from GameController to isolate timer-specific logic
 */
export class TurnTimerCoordinator {
  private playerSlotIndex: number;
  private onTimerExpired: () => void;

  constructor(playerId: string, onTimerExpired: () => void) {
    this.playerSlotIndex = parseInt(playerId);
    this.onTimerExpired = onTimerExpired;
  }

  /**
   * Start or stop the turn timer based on game state
   * Called when a turn changes or game state updates
   */
  handleTurnChange(gameState: GameStateData): void {
    const currentPlayerSlot = gameState.currentPlayerSlot;

    // Stop any existing timer first
    turnTimerStore.stopTimer();

    // Check if the game has ended - if so, don't start the timer
    const endResult = checkGameEnd(gameState, gameState.players);
    if (endResult.isGameEnded) {
      console.log('⏰ Game has ended, not starting timer');
      return;
    }

    // Start timer if it's this player's turn and they're human
    const isMyTurn = currentPlayerSlot === this.playerSlotIndex;
    const isHumanPlayer = gameState.players.some(p =>
      p.slotIndex === this.playerSlotIndex && !p.isAI
    );
    const timeLimit = gameState.moveTimeLimit || GAME_CONSTANTS.STANDARD_HUMAN_TIME_LIMIT;

    // Always show timer when it's the player's turn (human only), but not for unlimited time
    const isUnlimitedTime = timeLimit === GAME_CONSTANTS.UNLIMITED_TIME;
    if (isMyTurn && isHumanPlayer && timeLimit && !isUnlimitedTime) {
      console.log(`⏰ ✅ Starting timer for ${timeLimit} seconds`);
      turnTimerStore.startTimer(timeLimit, () => {
        console.log('⏰ Timer expired, auto-ending turn');
        this.onTimerExpired();
      });
    } else {
      console.log(`⏰ ❌ Timer NOT starting - conditions not met (isMyTurn: ${isMyTurn}, isHumanPlayer: ${isHumanPlayer}, timeLimit: ${timeLimit}, isUnlimitedTime: ${isUnlimitedTime})`);
    }
  }

  /**
   * Stop the turn timer
   */
  stopTimer(): void {
    turnTimerStore.stopTimer();
  }
}


