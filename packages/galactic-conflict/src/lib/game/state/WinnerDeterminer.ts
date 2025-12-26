/**
 * WinnerDeterminer - Handles winner determination logic for Galactic Conflict
 */

import type { Player } from '$lib/game/entities/gameTypes';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import type { GalacticGameState } from './GalacticGameState';

export class WinnerDeterminer {
    constructor(private gameState: GalacticGameState) {}

    /**
     * Determine the winner based on planets owned (then ships, then resources)
     */
    determineWinner(): Player | 'DRAWN_GAME' | null {
        const activePlayers = this.gameState.players.filter(p => !this.gameState.isPlayerEliminated(p.slotIndex));

        if (activePlayers.length === 0) {
            return GALACTIC_CONSTANTS.DRAWN_GAME;
        }

        if (activePlayers.length === 1) {
            return activePlayers[0];
        }

        return this.calculateWinnerFromScores(activePlayers);
    }

    /**
     * Calculate winner by scoring players and checking for ties
     */
    private calculateWinnerFromScores(activePlayers: Player[]): Player | 'DRAWN_GAME' {
        const scores = this.calculatePlayerScores(activePlayers);
        scores.sort(this.compareScores);

        const top = scores[0];
        const second = scores[1];
        
        if (this.isTie(top, second)) {
            return GALACTIC_CONSTANTS.DRAWN_GAME;
        }

        return top.player;
    }

    /**
     * Calculate scores for all active players
     */
    private calculatePlayerScores(activePlayers: Player[]) {
        return activePlayers.map(p => ({
            player: p,
            planets: this.gameState.getPlanetsOwnedBy(p.slotIndex).length,
            ships: this.gameState.getTotalShips(p.slotIndex),
            resources: this.gameState.getTotalResources(p.slotIndex),
        }));
    }

    /**
     * Compare two player scores (higher is better)
     */
    private compareScores(a: { planets: number; ships: number; resources: number }, b: { planets: number; ships: number; resources: number }): number {
        if (a.planets !== b.planets) return b.planets - a.planets;
        if (a.ships !== b.ships) return b.ships - a.ships;
        return b.resources - a.resources;
    }

    /**
     * Check if two scores represent a tie
     */
    private isTie(top: { planets: number; ships: number; resources: number }, second: { planets: number; ships: number; resources: number }): boolean {
        return top.planets === second.planets && top.ships === second.ships && top.resources === second.resources;
    }
}

