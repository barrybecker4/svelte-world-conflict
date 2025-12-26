import { writable, type Writable } from 'svelte/store';
import type { MoveState } from '$lib/game/mechanics/moveTypes';
import { IDLE, ADJUST_SOLDIERS, CANCEL } from '$lib/game/mechanics/moveConstants';
import { ModalManager } from './ModalManager';

/**
 * Coordinates move-related UI state and interactions
 */
export class MoveUICoordinator {
    private moveState: Writable<MoveState>;
    private modalManager: ModalManager;
    private gameStore: any;

    constructor(gameStore: any, modalManager: ModalManager) {
        this.gameStore = gameStore;
        this.modalManager = modalManager;

        this.moveState = writable({
            mode: IDLE,
            sourceRegion: null,
            targetRegion: null,
            buildRegion: null,
            selectedSoldierCount: 0,
            maxSoldiers: 0,
            availableMoves: 3,
            isMoving: false
        });
    }

    /**
     * Get the move state store for component binding
     */
    getMoveStateStore(): Writable<MoveState> {
        return this.moveState;
    }

    /**
     * Handle move state changes
     */
    handleMoveStateChange(newState: MoveState, onTooltipUpdate: () => void): void {
        this.moveState.set(newState);

        const shouldShowModal =
            newState.mode === ADJUST_SOLDIERS &&
            newState.sourceRegion !== null &&
            newState.targetRegion !== null &&
            !newState.isMoving;

        if (shouldShowModal) {
            this.modalManager.showSoldierSelection(newState.maxSoldiers, newState.selectedSoldierCount);
        } else {
            this.modalManager.hideSoldierSelection();
        }

        onTooltipUpdate();
    }

    /**
     * Handle soldier count change
     */
    handleSoldierCountChange(count: number): void {
        this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));
    }

    /**
     * Confirm soldier selection and execute the move
     */
    confirmSoldierSelection(count: number): void {
        this.moveState.update(s => ({ ...s, selectedSoldierCount: count }));
        this.modalManager.hideSoldierSelection();

        const moveSystem = this.gameStore.getMoveSystem();
        moveSystem?.processAction({
            type: ADJUST_SOLDIERS,
            payload: { soldierCount: count }
        });
    }

    /**
     * Cancel soldier selection
     */
    cancelSoldierSelection(): void {
        this.modalManager.hideSoldierSelection();
        const moveSystem = this.gameStore.getMoveSystem();
        moveSystem?.processAction({ type: CANCEL });
    }

    /**
     * Close temple upgrade panel
     */
    closeTempleUpgradePanel(): void {
        const moveSystem = this.gameStore.getMoveSystem();
        moveSystem?.processAction({ type: CANCEL });
    }

    /**
     * Handle region click from map
     */
    handleRegionClick(region: any, isMyTurn: boolean): void {
        if (!isMyTurn) return;

        const moveSystem = this.gameStore.getMoveSystem();
        if (!moveSystem) return;

        moveSystem.handleRegionClick(region.index);
    }

    /**
     * Handle temple click from map
     */
    handleTempleClick(regionIndex: number, isMyTurn: boolean): void {
        if (!isMyTurn) return;

        const moveSystem = this.gameStore.getMoveSystem();
        if (!moveSystem) return;

        moveSystem.handleTempleClick(regionIndex);
    }

    /**
     * Reset move state
     */
    resetMoveState(availableMoves: number = 3): void {
        this.moveState.set({
            mode: IDLE,
            sourceRegion: null,
            targetRegion: null,
            buildRegion: null,
            selectedSoldierCount: 0,
            maxSoldiers: 0,
            availableMoves,
            isMoving: false
        });
    }
}
