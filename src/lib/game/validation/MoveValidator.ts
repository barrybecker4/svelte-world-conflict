import type { MoveValidationResult } from '$lib/game/types/validation';
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
        if (!sourceRegion?.neighborIndices.includes(toRegion)) {
            return { isValid: false, error: "Regions are not adjacent" };
        }

        // Check if enough soldiers available
        const availableSoldiers = gameData.soldiersByRegion[fromRegion]?.length || 0;
        if (availableSoldiers < soldierCount) {
            return { isValid: false, error: `Not enough soldiers (have ${availableSoldiers}, need ${soldierCount})` };
        }

        // Check moves remaining
        if (gameData.movesRemaining <= 0) {
            return { isValid: false, error: "No moves remaining this turn" };
        }

        return { isValid: true };
    }
}