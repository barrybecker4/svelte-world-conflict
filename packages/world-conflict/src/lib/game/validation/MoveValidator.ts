import type { MoveValidationResult } from './validation';
import type { GameStateData } from '$lib/game/entities/gameTypes';

export class MoveValidator {
    /**
     * Validate a specific move operation
     * Works directly with GameStateData, no dependency on GameState
     */
    static validateMove(
        gameData: GameStateData,
        fromRegion: number,
        toRegion: number,
        soldierCount: number
    ): MoveValidationResult {

        const currentPlayer = gameData.players.find(p => p.slotIndex === gameData.currentPlayerSlot);
        if (!currentPlayer) {
            return { isValid: false, error: "Current player not found" };
        }

        // Check if player owns the source region
        if (gameData.ownersByRegion[fromRegion] !== currentPlayer.slotIndex) {
            return { isValid: false, error: "Cannot move soldiers from region you don't own" };
        }

        // Check if regions are adjacent
        const sourceRegion = gameData.regions.find(r => r.index === fromRegion);
        if (!sourceRegion?.neighbors.includes(toRegion)) {
            return { isValid: false, error: "Regions are not adjacent" };
        }

        // Check if enough soldiers available
        const availableSoldiers = gameData.soldiersByRegion[fromRegion]?.length || 0;
        if (availableSoldiers < soldierCount) {
            return { isValid: false, error: `Not enough soldiers (have ${availableSoldiers}, need ${soldierCount})` };
        }

        // Must leave at least 1 soldier in source region
        if (availableSoldiers - soldierCount < 1) {
            return { isValid: false, error: "Must leave at least 1 soldier in source region" };
        }

        return { isValid: true };
    }
}
