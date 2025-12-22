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
                    minShipsToSend: 5,
                    defenseBuffer: 3,
                },
                build: {
                    resourceMultiplier: 2,
                    minShipsOnPlanet: 3,
                    maxBuildAtOnce: 1,
                },
            };
        case 'medium':
            return {
                cooldown: 9000, // moderate
                attack: {
                    minSourceShips: 5,
                    minAdvantage: 2,
                    minShipsToSend: 4,
                    defenseBuffer: 2,
                },
                build: {
                    resourceMultiplier: 1.5,
                    minShipsOnPlanet: 2,
                    maxBuildAtOnce: 5,
                },
            };
        case 'hard':
            return {
                cooldown: 3000, // aggressive
                attack: {
                    minSourceShips: 3,
                    minAdvantage: 1,
                    minShipsToSend: 3,
                    defenseBuffer: 1,
                },
                build: {
                    resourceMultiplier: 1,
                    minShipsOnPlanet: 0,
                    maxBuildAtOnce: 10,
                },
            };
        default:
            // Default to medium
            return getAIDifficultyConfig('medium');
    }
}

