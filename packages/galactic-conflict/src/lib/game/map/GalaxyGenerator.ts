/**
 * Galaxy Generator - Creates a galaxy with randomly placed planets
 */

import type { Planet, Position, Player } from '$lib/game/entities/gameTypes';
import { createPlanet, getPlanetRadius, getDistanceBetweenPositions, getPlanetProduction } from '$lib/game/entities/Planet';
import { generatePlanetName } from '$lib/game/entities/PlanetNameGenerator';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
import { RandomNumberGenerator } from 'multiplayer-framework/shared';
import { logger } from 'multiplayer-framework/shared';

export interface GalaxyGenerationOptions {
    /** Number of neutral planets to generate */
    neutralPlanetCount: number;
    /** Galaxy width in units */
    width?: number;
    /** Galaxy height in units */
    height?: number;
    /** Number of players (for starting planet placement) */
    playerCount: number;
    /** Players with their slot indices (for assigning starting planets) */
    players: Player[];
    /** Random seed for reproducible generation */
    seed?: string;
    /** Minimum defending ships on neutral planets */
    neutralShipsMin?: number;
    /** Maximum multiplier for neutral planet defenders (applied to production) */
    neutralShipsMultiplierMax?: number;
}

const MAX_PLACEMENT_ATTEMPTS = 100;
const EDGE_PADDING = 50; // Minimum distance from edge

/**
 * Generate a galaxy with randomly placed planets
 */
export class GalaxyGenerator {
    private width: number;
    private height: number;
    private rng: RandomNumberGenerator;

    constructor(
        width: number = GALACTIC_CONSTANTS.GALAXY_WIDTH,
        height: number = GALACTIC_CONSTANTS.GALAXY_HEIGHT,
        seed?: string
    ) {
        this.width = width;
        this.height = height;
        this.rng = new RandomNumberGenerator(seed || `galaxy-${Date.now()}`);
    }

    /**
     * Generate a galaxy with the specified number of planets
     */
    generate(options: GalaxyGenerationOptions): Planet[] {
        const {
            neutralPlanetCount,
            width = this.width,
            height = this.height,
            playerCount,
            players,
            neutralShipsMin = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MIN,
            neutralShipsMultiplierMax = GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MULTIPLIER_MAX,
        } = options;

        const totalPlanetCount = playerCount + neutralPlanetCount;
        logger.debug(`Generating galaxy with ${totalPlanetCount} planets (${playerCount} players, ${neutralPlanetCount} neutral) for ${playerCount} players`);

        const planets: Planet[] = [];

        // First, place player starting planets evenly distributed
        const startingPlanets = this.placeStartingPlanets(players, width, height);
        planets.push(...startingPlanets);

        // Then fill in with neutral planets
        const neutralPlanetsNeeded = neutralPlanetCount;
        const neutralPlanets = this.placeNeutralPlanets(
            neutralPlanetsNeeded,
            planets,
            width,
            height,
            neutralShipsMin,
            neutralShipsMultiplierMax
        );
        planets.push(...neutralPlanets);

        logger.debug(`Generated ${planets.length} planets (${startingPlanets.length} starting, ${neutralPlanets.length} neutral)`);

        return planets;
    }

    /**
     * Place starting planets for each player, evenly distributed around the galaxy
     */
    private placeStartingPlanets(
        players: Player[],
        width: number,
        height: number
    ): Planet[] {
        const planets: Planet[] = [];
        const playerCount = players.length;

        // Calculate positions in a circle around the center
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35; // 35% of smaller dimension

        for (let i = 0; i < playerCount; i++) {
            const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2; // Start from top
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const planet = createPlanet(
                planets.length,
                `${players[i].name}'s Homeworld`,
                { x, y },
                GALACTIC_CONSTANTS.STARTING_PLANET_VOLUME,
                players[i].slotIndex,
                GALACTIC_CONSTANTS.STARTING_SHIPS
            );

            planets.push(planet);
        }

        return planets;
    }

    /**
     * Place neutral planets randomly, avoiding existing planets
     */
    private placeNeutralPlanets(
        count: number,
        existingPlanets: Planet[],
        width: number,
        height: number,
        neutralShipsMin: number,
        neutralShipsMultiplierMax: number
    ): Planet[] {
        const planets: Planet[] = [];
        let planetId = existingPlanets.length;

        for (let i = 0; i < count; i++) {
            const planet = this.tryPlaceNeutralPlanet(
                planetId,
                [...existingPlanets, ...planets],
                width,
                height,
                neutralShipsMin,
                neutralShipsMultiplierMax
            );

            if (planet) {
                planets.push(planet);
                planetId++;
            } else {
                logger.warn(`Could not place neutral planet ${i + 1}/${count} after ${MAX_PLACEMENT_ATTEMPTS} attempts`);
            }
        }

        return planets;
    }

    /**
     * Try to place a single neutral planet
     */
    private tryPlaceNeutralPlanet(
        id: number,
        existingPlanets: Planet[],
        width: number,
        height: number,
        neutralShipsMin: number,
        neutralShipsMultiplierMax: number
    ): Planet | null {
        for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
            // Random volume
            const volume = this.rng.nextInt(
                GALACTIC_CONSTANTS.PLANET_VOLUME_MIN,
                GALACTIC_CONSTANTS.PLANET_VOLUME_MAX
            );

            const radius = getPlanetRadius(volume);

            // Random position with padding for planet radius and edge
            const padding = EDGE_PADDING + radius;
            const x = this.rng.nextInt(padding, width - padding);
            const y = this.rng.nextInt(padding, height - padding);

            const position: Position = { x, y };

            // Check for overlaps
            if (this.isValidPosition(position, radius, existingPlanets)) {
                return this.createNeutralPlanet(
                    id,
                    position,
                    volume,
                    neutralShipsMin,
                    neutralShipsMultiplierMax
                );
            }
        }

        return null;
    }

    /**
     * Create a neutral planet with random defending ships
     */
    private createNeutralPlanet(
        id: number,
        position: Position,
        volume: number,
        neutralShipsMin: number,
        neutralShipsMultiplierMax: number
    ): Planet {
        const ships = this.calculateDefendingNeutralShips(
            volume,
            neutralShipsMin,
            neutralShipsMultiplierMax
        );

        return createPlanet(
            id,
            generatePlanetName(id),
            position,
            volume,
            null, // Neutral - no owner
            ships
        );
    }

    /**
     * Calculate random number of defending ships based on production capacity
     */
    private calculateDefendingNeutralShips(
        volume: number,
        neutralShipsMin: number,
        neutralShipsMultiplierMax: number
    ): number {
        const production = getPlanetProduction(volume);
        const multiplier = this.rng.nextInt(
            GALACTIC_CONSTANTS.NEUTRAL_SHIPS_MULTIPLIER_MIN,
            neutralShipsMultiplierMax
        );
        const maxShips = Math.max(neutralShipsMin, production * multiplier);
        return this.rng.nextInt(neutralShipsMin, maxShips);
    }

    /**
     * Check if a position is valid (not overlapping with existing planets)
     */
    private isValidPosition(
        position: Position,
        radius: number,
        existingPlanets: Planet[]
    ): boolean {
        for (const planet of existingPlanets) {
            const existingRadius = getPlanetRadius(planet.volume);
            const distance = getDistanceBetweenPositions(position, planet.position);
            const minDistance = radius + existingRadius + GALACTIC_CONSTANTS.MIN_PLANET_DISTANCE;

            if (distance < minDistance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get the RNG for further use (e.g., in game state)
     */
    getRng(): RandomNumberGenerator {
        return this.rng;
    }
}

/**
 * Helper function to generate a galaxy with default settings
 */
export function generateGalaxy(options: GalaxyGenerationOptions): Planet[] {
    const generator = new GalaxyGenerator(
        options.width,
        options.height,
        options.seed
    );
    return generator.generate(options);
}
