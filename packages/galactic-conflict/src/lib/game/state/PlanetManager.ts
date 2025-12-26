/**
 * PlanetManager - Handles planet-related operations
 */

import type { Planet } from '$lib/game/entities/gameTypes';

export class PlanetManager {
    constructor(private planets: Planet[]) {}

    getPlanet(planetId: number): Planet | undefined {
        return this.planets.find(p => p.id === planetId);
    }

    getPlanetsOwnedBy(playerId: number): Planet[] {
        return this.planets.filter(p => p.ownerId === playerId);
    }

    setPlanetOwner(planetId: number, ownerId: number | null): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ownerId = ownerId;
        }
    }

    setPlanetShips(planetId: number, ships: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ships = Math.max(0, ships);
        }
    }

    addPlanetShips(planetId: number, ships: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.ships = Math.max(0, planet.ships + ships);
        }
    }

    addPlanetResources(planetId: number, resources: number): void {
        const planet = this.getPlanet(planetId);
        if (planet) {
            planet.resources = Math.max(0, planet.resources + resources);
        }
    }

    spendPlanetResources(planetId: number, amount: number): boolean {
        const planet = this.getPlanet(planetId);
        if (planet && planet.resources >= amount) {
            planet.resources -= amount;
            return true;
        }
        return false;
    }

    getAllPlanets(): Planet[] {
        return this.planets;
    }
}
