/**
 * AI Difficulty Configuration
 * Centralized configuration for AI behavior based on difficulty level
 */

import type { AiDifficulty } from '$lib/game/entities/gameTypes';

export interface AIDifficultyConfig {
    /** Cooldown time between AI decisions (ms) */
    cooldown: number;

    /** Attack configuration */
    attack: {
        /** Minimum ships on source planet to consider attack */
        minSourceShips: number;
        /** Minimum advantage (ships difference) to attack */
        minAdvantage: number;
        /** Minimum ships to send in an attack */
        minShipsToSend: number;
        /** Defense buffer (ships to keep on planet) */
        defenseBuffer: number;
    };

    /** Build configuration */
    build: {
        /** Resource multiplier for build threshold */
        resourceMultiplier: number;
        /** Minimum ships on planet to consider building */
        minShipsOnPlanet: number;
        /** Maximum ships to build at once */
        maxBuildAtOnce: number;
    };
}

/**
 * Get AI difficulty configuration
 */
export function getAIDifficultyConfig(difficulty: AiDifficulty): AIDifficultyConfig {
    switch (difficulty) {
        case 'easy':
            return {
                cooldown: 30000, // infrequent
                attack: {
                    minSourceShips: 10,
                    minAdvantage: 4,
                    minShipsToSend: 6,
                    defenseBuffer: 5,
                },
                build: {
                    resourceMultiplier: 2,
                    minShipsOnPlanet: 3,
                    maxBuildAtOnce: 3,
                },
            };
        case 'medium':
            return {
                cooldown: 10000, // moderate
                attack: {
                    minSourceShips: 6,
                    minAdvantage: 2,
                    minShipsToSend: 4,
                    defenseBuffer: 3,
                },
                build: {
                    resourceMultiplier: 1.5,
                    minShipsOnPlanet: 2,
                    maxBuildAtOnce: 5,
                },
            };
        case 'hard':
            return {
                cooldown: 2500, // very aggressive - more frequent decisions
                attack: {
                    minSourceShips: 2, // attack with fewer ships
                    minAdvantage: 1, // require slight advantage for primary attacks
                    minShipsToSend: 2, // send small fleets, but not single ships
                    defenseBuffer: 2, // keep 1 ship for defense
                },
                build: {
                    resourceMultiplier: 1,
                    minShipsOnPlanet: 0,
                    maxBuildAtOnce: 20, // build more aggressively
                },
            };
        default:
            // Default to medium
            return getAIDifficultyConfig('medium');
    }
}
