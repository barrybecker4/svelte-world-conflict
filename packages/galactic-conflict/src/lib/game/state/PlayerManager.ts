/**
 * PlayerManager - Handles player-related operations
 */

import type { Player, Planet, Armada } from '$lib/game/entities/gameTypes';

export class PlayerManager {
    constructor(
        private players: Player[],
        private eliminatedPlayers: number[],
        private resourcesByPlayer: Record<number, number>
    ) {}

    getPlayer(slotIndex: number): Player | undefined {
        return this.players.find(p => p.slotIndex === slotIndex);
    }

    isPlayerEliminated(slotIndex: number): boolean {
        return this.eliminatedPlayers.includes(slotIndex);
    }

    eliminatePlayer(slotIndex: number): void {
        if (!this.isPlayerEliminated(slotIndex)) {
            this.eliminatedPlayers.push(slotIndex);
        }
    }

    /**
     * Check if a player has any planets or ships (armadas)
     */
    isPlayerAlive(slotIndex: number, planets: Planet[], armadas: Armada[]): boolean {
        const hasPlanets = planets.some(p => p.ownerId === slotIndex);
        const hasShips = armadas.some(a => a.ownerId === slotIndex);
        const hasPlanetShips = planets.some(p => p.ownerId === slotIndex && p.ships > 0);
        return hasPlanets || hasShips || hasPlanetShips;
    }

    /**
     * Get total ships for a player (on planets + in armadas)
     */
    getTotalShips(slotIndex: number, planets: Planet[], armadas: Armada[]): number {
        const planetShips = planets
            .filter(p => p.ownerId === slotIndex)
            .reduce((sum, p) => sum + p.ships, 0);
        const armadaShips = armadas
            .filter(a => a.ownerId === slotIndex)
            .reduce((sum, a) => sum + a.ships, 0);
        return planetShips + armadaShips;
    }

    /**
     * Get player's global resources
     */
    getPlayerResources(slotIndex: number): number {
        return this.resourcesByPlayer[slotIndex] ?? 0;
    }

    /**
     * Add resources to a player's global pool
     */
    addPlayerResources(slotIndex: number, amount: number): void {
        if (!this.resourcesByPlayer[slotIndex]) {
            this.resourcesByPlayer[slotIndex] = 0;
        }
        this.resourcesByPlayer[slotIndex] += amount;
    }

    /**
     * Spend resources from a player's global pool
     * Returns true if successful, false if not enough resources
     */
    spendPlayerResources(slotIndex: number, amount: number): boolean {
        const currentResources = this.getPlayerResources(slotIndex);
        if (currentResources >= amount) {
            this.resourcesByPlayer[slotIndex] = currentResources - amount;
            return true;
        }
        return false;
    }

    /**
     * Get total resources for a player (alias for getPlayerResources for compatibility)
     */
    getTotalResources(slotIndex: number): number {
        return this.getPlayerResources(slotIndex);
    }

    getAllPlayers(): Player[] {
        return this.players;
    }

    getEliminatedPlayers(): number[] {
        return this.eliminatedPlayers;
    }

    getResourcesByPlayer(): Record<number, number> {
        return this.resourcesByPlayer;
    }
}
