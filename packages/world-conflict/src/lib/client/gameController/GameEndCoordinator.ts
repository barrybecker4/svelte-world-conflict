import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { ModalManager } from './ModalManager';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';

/**
 * Coordinates game end detection and presentation
 * Extracted from GameController to isolate game-over logic
 */
export class GameEndCoordinator {
  private modalManager: ModalManager;
  private turnTimerCoordinator: TurnTimerCoordinator;
  private playerId: string;
  private gameEndChecked = false;

  constructor(
    playerId: string,
    modalManager: ModalManager,
    turnTimerCoordinator: TurnTimerCoordinator
  ) {
    this.playerId = playerId;
    this.modalManager = modalManager;
    this.turnTimerCoordinator = turnTimerCoordinator;
  }

  /**
   * Check for game end and handle the end-game presentation
   */
  checkGameEnd(gameState: GameStateData | null, players: Player[]): void {
    if (!gameState || players.length === 0 || this.gameEndChecked) {
      return;
    }

    const endResult = checkGameEnd(gameState, players);

    if (endResult.isGameEnded) {
      this.gameEndChecked = true;

      // Stop the timer when the game ends
      this.turnTimerCoordinator.stopTimer();

      // Play sound based on whether this player won
      const isWinner =
        endResult.winner !== 'DRAWN_GAME' &&
        endResult.winner?.slotIndex?.toString() === this.playerId;

      audioSystem.playSound(isWinner ? SOUNDS.GAME_WON : SOUNDS.GAME_LOST);

      // Trigger game summary display (will show victory banner then summary panel)
      this.modalManager.showGameSummary(endResult.winner!);
    }
  }
}