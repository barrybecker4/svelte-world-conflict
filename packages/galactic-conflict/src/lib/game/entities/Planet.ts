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
 * Calculate travel time in milliseconds for an armada to travel between planets
 *
export function getTravelTime(planet1: Planet, planet2: Planet, speed: number): number {
    const distance = getDistanceBetweenPlanets(planet1, planet2);
    // Speed is in units per minute, convert to milliseconds
    const timeInMinutes = distance / speed;
    return timeInMinutes * 60 * 1000;
}*/

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

/**
 * Check if a position is within a planet's bounds
 *
export function isPositionInPlanet(position: Position, planet: Planet): boolean {
    const radius = getPlanetRadius(planet.volume);
    const distance = getDistanceBetweenPositions(position, planet.position);
    return distance <= radius;
}*/

/**
 * Check if two planets overlap (for galaxy generation)
 *
export function doPlanetsOverlap(planet1: Planet, planet2: Planet, minDistance: number = 0): boolean {
    const radius1 = getPlanetRadius(planet1.volume);
    const radius2 = getPlanetRadius(planet2.volume);
    const distance = getDistanceBetweenPlanets(planet1, planet2);
    return distance < radius1 + radius2 + minDistance;
}*/

/**
 * Generate a random planet name
 */
const PLANET_PREFIXES = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
    'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
    'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

const PLANET_SUFFIXES = [
    'Prime', 'Major', 'Minor', 'Proxima', 'Centauri', 'Nova', 'Stella',
    'Astra', 'Cosmo', 'Nebula', 'Vega', 'Orion', 'Lyra', 'Cygnus'
];

export function generatePlanetName(index: number): string {
    const prefix = PLANET_PREFIXES[index % PLANET_PREFIXES.length];
    const suffix = PLANET_SUFFIXES[Math.floor(index / PLANET_PREFIXES.length) % PLANET_SUFFIXES.length];
    const number = Math.floor(index / (PLANET_PREFIXES.length * PLANET_SUFFIXES.length));

    if (number > 0) {
        return `${prefix} ${suffix} ${number + 1}`;
    }
    return `${prefix} ${suffix}`;
}

