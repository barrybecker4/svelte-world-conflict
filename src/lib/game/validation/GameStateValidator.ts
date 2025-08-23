import type { ValidationResult } from '$lib/game/types/validation';
import type { GameStateData } from '$lib/game/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

export class GameStateValidator {
    /**
     * Validate game state data for consistency and integrity
     * Works directly with GameStateData, no dependency on WorldConflictGameState
     */
    static validate(gameData: GameStateData): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate players
        if (gameData.players.length === 0) {
            errors.push("Game must have at least one player");
        }

        if (gameData.players.length > GAME_CONSTANTS.MAX_PLAYERS) {
            errors.push(`Game cannot have more than ${GAME_CONSTANTS.MAX_PLAYERS} players`);
        }

        // Validate regions
        if (gameData.regions.length < GAME_CONSTANTS.MIN_REGIONS) {
            warnings.push(`Map has fewer than recommended minimum regions (${GAME_CONSTANTS.MIN_REGIONS})`);
        }

        // Validate current player index
        if (gameData.playerIndex >= gameData.players.length) {
            errors.push("Current player index is out of bounds");
        }

        // Validate soldier ownership consistency
        Object.entries(gameData.soldiersByRegion).forEach(([regionIndex, soldiers]) => {
            const regionIdx = parseInt(regionIndex);
            const owner = gameData.ownersByRegion[regionIdx];

            if (soldiers.length > 0 && owner === undefined) {
                warnings.push(`Region ${regionIndex} has soldiers but no owner`);
            }
        });

        // Validate temple consistency
        Object.entries(gameData.templesByRegion).forEach(([regionIndex, temple]) => {
            const regionIdx = parseInt(regionIndex);
            const region = gameData.regions.find(r => r.index === regionIdx);

            if (!region) {
                errors.push(`Temple exists in non-existent region ${regionIndex}`);
            } else if (!region.hasTemple) {
                errors.push(`Temple exists in region ${regionIndex} that shouldn't have a temple`);
            }

            if (temple.level > GAME_CONSTANTS.MAX_TEMPLE_LEVEL) {
                errors.push(`Temple in region ${regionIndex} exceeds maximum level`);
            }
        });

        // Validate cash consistency
        gameData.players.forEach(player => {
            if (!(player.index in gameData.cashByPlayer)) {
                warnings.push(`Player ${player.index} has no cash entry`);
            } else if (gameData.cashByPlayer[player.index] < 0) {
                errors.push(`Player ${player.index} has negative cash`);
            }
        });

        // Validate turn state
        if (gameData.movesRemaining < 0) {
            errors.push("Moves remaining cannot be negative");
        }

        if (gameData.movesRemaining > GAME_CONSTANTS.BASE_MOVES_PER_TURN) {
            warnings.push(`Moves remaining (${gameData.movesRemaining}) exceeds normal maximum`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}