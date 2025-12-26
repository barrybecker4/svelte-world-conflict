/**
 * Planet entity helper functions
 */

import type { Planet, Position } from './gameTypes';
import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';

/**
 * Calculate the visual radius of a planet based on its volume
 * Radius is proportional to the cube root of volume
 */
export function getPlanetRadius(volume: number): number {
    return Math.cbrt(volume) * GALACTIC_CONSTANTS.PLANET_RADIUS_SCALE;
}

/**
 * Calculate the resource production per minute for a planet
 */
export function getPlanetProduction(volume: number): number {
    return volume * GALACTIC_CONSTANTS.RESOURCES_PER_VOLUME_PER_MINUTE;
}

/**
 * Calculate the distance between two planets
 */
export function getDistanceBetweenPlanets(planet1: Planet, planet2: Planet): number {
    return getDistanceBetweenPositions(planet1.position, planet2.position);
}

/**
 * Calculate the distance between two positions
 */
export function getDistanceBetweenPositions(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a new planet with default values
 */
export function createPlanet(
    id: number,
    name: string,
    position: Position,
    volume: number,
    ownerId: number | null = null,
    ships: number = 0
): Planet {
    return {
        id,
        name,
        position,
        volume,
        ownerId,
        ships,
        resources: 0,
    };
}
