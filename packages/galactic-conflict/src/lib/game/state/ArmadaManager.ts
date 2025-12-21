/**
 * ArmadaManager - Handles armada-related operations
 */

import type { Armada, GameEvent } from '$lib/game/entities/gameTypes';
import { v4 as uuidv4 } from 'uuid';

export class ArmadaManager {
    constructor(
        private armadas: Armada[],
        private scheduleEventCallback: (event: GameEvent) => void
    ) {}

    addArmada(armada: Armada): void {
        this.armadas.push(armada);

        // Schedule arrival event
        this.scheduleEventCallback({
            id: uuidv4(),
            type: 'armada_arrival',
            scheduledTime: armada.arrivalTime,
            payload: { armadaId: armada.id },
        });
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

