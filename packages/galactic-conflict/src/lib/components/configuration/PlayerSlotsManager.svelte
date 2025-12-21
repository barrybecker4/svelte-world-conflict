<script lang="ts">
    import type { PlayerSlot } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import PlayerSlotComponent from '../common/PlayerSlot.svelte';

    export let playerSlots: PlayerSlot[];
    export let canAddMorePlayers: boolean;
    export let onAddOpenSlot: () => void;
    export let onAddAIPlayer: () => void;
    export let onRemoveSlot: (slotIndex: number) => void;
    export let onUpdateDifficulty: (slotIndex: number, difficulty: string) => void;
</script>

<section class="players-section">
    <h2>Players ({playerSlots.length})</h2>
    
    <div class="add-player-buttons">
        <button
            class="add-btn add-open"
            on:click={onAddOpenSlot}
            disabled={!canAddMorePlayers}
        >
            <span class="add-icon">+</span>
            Add Open Slot
        </button>
        <button
            class="add-btn add-ai"
            on:click={onAddAIPlayer}
            disabled={!canAddMorePlayers}
        >
            <span class="add-icon">+</span>
            Add AI Player
        </button>
    </div>

    <div class="player-grid">
        {#each playerSlots as slot (slot.slotIndex)}
            <PlayerSlotComponent
                {slot}
                isCurrent={slot.slotIndex === 0}
                showRemoveButton={true}
                onRemove={() => onRemoveSlot(slot.slotIndex)}
                onDifficultyChange={(difficulty) => onUpdateDifficulty(slot.slotIndex, difficulty)}
            />
        {/each}
    </div>

    {#if !canAddMorePlayers}
        <p class="hint">Maximum {GALACTIC_CONSTANTS.MAX_PLAYERS} players reached</p>
    {/if}
</section>

<style>
    .players-section {
        margin-bottom: 1rem;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .add-player-buttons {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .add-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 2px dashed #4b5563;
        border-radius: 8px;
        color: #9ca3af;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .add-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: #e5e7eb;
    }

    .add-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .add-btn.add-open:hover:not(:disabled) {
        border-color: #3b82f6;
        color: #60a5fa;
    }

    .add-btn.add-ai:hover:not(:disabled) {
        border-color: #a855f7;
        color: #c084fc;
    }

    .add-icon {
        font-size: 1.25rem;
        font-weight: bold;
        line-height: 1;
    }

    .player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .hint {
        font-size: 0.85rem;
        color: #9ca3af;
        text-align: center;
        margin: 0;
    }

    @media (max-width: 640px) {
        .player-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>

