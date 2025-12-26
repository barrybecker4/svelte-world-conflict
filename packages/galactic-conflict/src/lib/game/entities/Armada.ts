/**
 * Armada entity helper functions
 */

import type { Armada, Planet, Position } from './gameTypes';
import { getDistanceBetweenPositions } from './Planet';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new armada
 */
export function createArmada(
    ownerId: number,
    ships: number,
    sourcePlanet: Planet,
    destinationPlanet: Planet,
    armadaSpeed: number,
    currentTime: number = Date.now()
): Armada {
    const distance = getDistanceBetweenPositions(sourcePlanet.position, destinationPlanet.position);
    const travelTimeMs = (distance / armadaSpeed) * 60 * 1000; // Convert minutes to ms
    
    return {
        id: uuidv4(),
        ownerId,
        ships,
        sourcePlanetId: sourcePlanet.id,
        destinationPlanetId: destinationPlanet.id,
        departureTime: currentTime,
        arrivalTime: currentTime + travelTimeMs,
    };
}

/**
 * Calculate the current position of an armada based on elapsed time
 */
export function getArmadaCurrentPosition(
    armada: Armada,
    sourcePlanet: Planet,
    destinationPlanet: Planet,
    currentTime: number = Date.now()
): Position {
    const totalTime = armada.arrivalTime - armada.departureTime;
    const elapsedTime = currentTime - armada.departureTime;
    
    // Clamp progress between 0 and 1
    const progress = Math.max(0, Math.min(1, elapsedTime / totalTime));
    
    // Linear interpolation between source and destination
    const x = sourcePlanet.position.x + (destinationPlanet.position.x - sourcePlanet.position.x) * progress;
    const y = sourcePlanet.position.y + (destinationPlanet.position.y - sourcePlanet.position.y) * progress;
    
    return { x, y };
}

/**
 * Check if an armada has arrived at its destination
 */
export function hasArmadaArrived(armada: Armada, currentTime: number = Date.now()): boolean {
    return currentTime >= armada.arrivalTime;
}

/**
 * Get the progress of an armada (0 to 1)
 */
export function getArmadaProgress(armada: Armada, currentTime: number = Date.now()): number {
    const totalTime = armada.arrivalTime - armada.departureTime;
    const elapsedTime = currentTime - armada.departureTime;
    return Math.max(0, Math.min(1, elapsedTime / totalTime));
}

/**
 * Get remaining travel time in milliseconds
 */
export function getRemainingTravelTime(armada: Armada, currentTime: number = Date.now()): number {
    return Math.max(0, armada.arrivalTime - currentTime);
}

/**
 * Calculate total travel time for an armada
 */
export function calculateTravelTime(
    sourcePlanet: Planet,
    destinationPlanet: Planet,
    armadaSpeed: number
): number {
    const distance = getDistanceBetweenPositions(sourcePlanet.position, destinationPlanet.position);
    return (distance / armadaSpeed) * 60 * 1000; // Convert minutes to ms
}
