/**
 * ArmadaManager - Handles armada-related operations
 */

import type { Armada } from '$lib/game/entities/gameTypes';

export class ArmadaManager {
    constructor(
        private armadas: Armada[]
    ) {}

    addArmada(armada: Armada): void {
        this.armadas.push(armada);
    }

    removeArmada(armadaId: string): Armada | undefined {
        const index = this.armadas.findIndex(a => a.id === armadaId);
        if (index >= 0) {
            return this.armadas.splice(index, 1)[0];
        }
        return undefined;
    }

    getArmada(armadaId: string): Armada | undefined {
        return this.armadas.find(a => a.id === armadaId);
    }

    getArmadasForPlayer(slotIndex: number): Armada[] {
        return this.armadas.filter(a => a.ownerId === slotIndex);
    }

    getAllArmadas(): Armada[] {
        return this.armadas;
    }
}
