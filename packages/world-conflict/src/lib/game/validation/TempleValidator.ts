import type { MoveValidationResult } from './validation';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

export class TempleValidator {
    /**
     * Validate that a region can support a temple build/upgrade
     * Works directly with GameStateData, no dependency on GameState
     */
    static validateTempleOperation(
        gameData: GameStateData,
        regionIndex: number,
        operationType: 'build' | 'upgrade'
    ): MoveValidationResult {
        const currentPlayer = gameData.players.find(p => p.slotIndex === gameData.currentPlayerSlot);
        if (!currentPlayer) {
            return { isValid: false, error: "Current player not found" };
        }
        const region = gameData.regions.find(r => r.index === regionIndex);

        if (!region) {
            return { isValid: false, error: "Region does not exist" };
        }

        // Check ownership
        if (gameData.ownersByRegion[regionIndex] !== currentPlayer.slotIndex) {
            return { isValid: false, error: "Cannot build on region you don't own" };
        }

        if (operationType === 'build') {
            // Check if region can support a temple
            if (!region.hasTemple) {
                return { isValid: false, error: "This region cannot support a temple" };
            }

            // Check if temple already exists
            if (gameData.templesByRegion[regionIndex]) {
                return { isValid: false, error: "Temple already exists in this region" };
            }
        } else { // upgrade
            const temple = gameData.templesByRegion[regionIndex];
            if (!temple) {
                return { isValid: false, error: "No temple to upgrade in this region" };
            }

            if (temple.level >= GAME_CONSTANTS.MAX_TEMPLE_LEVEL) {
                return { isValid: false, error: "Temple is already at maximum level" };
            }
        }

        return { isValid: true };
    }
}
