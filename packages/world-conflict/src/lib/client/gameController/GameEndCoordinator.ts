import { audioSystem } from '$lib/client/audio/AudioSystem';
import { SOUNDS } from '$lib/client/audio/sounds';
import { checkGameEnd } from '$lib/game/mechanics/endGameLogic';
import type { Player, GameStateData } from '$lib/game/entities/gameTypes';
import { ModalManager } from './ModalManager';
import { TurnTimerCoordinator } from './TurnTimerCoordinator';
import { removeGameCreator } from '$lib/client/stores/clientStorage';

/**
 * Coordinates game end detection and presentation
 */
export class GameEndCoordinator {
    private modalManager: ModalManager;
    private turnTimerCoordinator: TurnTimerCoordinator;
    private readonly playerSlotIndex: number;
    private readonly gameId: string;
    private gameEndChecked = false;
    private updateGameState: ((updater: (state: GameStateData) => GameStateData) => void) | null = null;

    constructor(
        gameId: string,
        playerId: string,
        modalManager: ModalManager,
        turnTimerCoordinator: TurnTimerCoordinator,
        updateGameState?: (updater: (state: GameStateData) => GameStateData) => void
    ) {
        this.gameId = gameId;
        this.playerSlotIndex = parseInt(playerId);
        this.modalManager = modalManager;
        this.turnTimerCoordinator = turnTimerCoordinator;
        this.updateGameState = updateGameState || null;
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

            if (this.updateGameState && gameState) {
                this.updateGameState(state => {
                    if (!state) return state;
                    return { ...state, endResult: endResult.winner };
                });
            }

            this.turnTimerCoordinator.stopTimer();

            // Clean up localStorage entry for this game since it's completed
            removeGameCreator(this.gameId);

            const isWinner = endResult.winner !== 'DRAWN_GAME' && endResult.winner?.slotIndex === this.playerSlotIndex;

            audioSystem.playSound(isWinner ? SOUNDS.GAME_WON : SOUNDS.GAME_LOST);
            this.modalManager.showGameSummary(endResult.winner!);
        }
    }
}
