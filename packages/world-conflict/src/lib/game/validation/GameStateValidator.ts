import type { ValidationResult } from './validation';
import type { GameStateData } from '$lib/game/entities/gameTypes';
import { GAME_CONSTANTS } from '$lib/game/constants/gameConstants';

export class GameStateValidator {
    /**
     * Validate game state data for consistency and integrity
     * Works directly with GameStateData, no dependency on GameState
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

        //  Validate if there's a player with this slot index
        const currentPlayer = gameData.players.find(p => p.slotIndex === gameData.currentPlayerSlot);
        if (!currentPlayer) {
            errors.push(`No player found with slot index ${gameData.currentPlayerSlot}`);
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

        // Validate faith consistency
        gameData.players.forEach(player => {
            if (!(player.slotIndex in gameData.faithByPlayer)) {
                warnings.push(`Player ${player.slotIndex} has no faith entry`);
            } else if (gameData.faithByPlayer[player.slotIndex] < 0) {
                errors.push(`Player ${player.slotIndex} has negative faith`);
            }
        });

        // Validate turn state
        if (gameData.movesRemaining < 0) {
            errors.push("Moves remaining cannot be negative");
        }

        // Allow extra moves for Air upgrade
        const maxReasonableMoves = GAME_CONSTANTS.BASE_MOVES_PER_TURN + 10; // Allow for multiple Air temples
        if (gameData.movesRemaining > maxReasonableMoves) {
            warnings.push(`Moves remaining (${gameData.movesRemaining}) seems unusually high`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
}
