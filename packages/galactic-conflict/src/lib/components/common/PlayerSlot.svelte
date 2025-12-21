<script lang="ts">
    import type { PlayerSlot as PlayerSlotType } from '$lib/game/entities/gameTypes';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let slot: PlayerSlotType;
    export let isCurrent: boolean = false;
    export let showRemoveButton: boolean = false;
    export let onRemove: (() => void) | null = null;
    export let onDifficultyChange: ((difficulty: string) => void) | null = null;

    // Always show the player's assigned color based on slotIndex
    $: slotColor = getPlayerColor(slot.slotIndex);
</script>

<div
    class="player-slot"
    class:filled={slot.type === 'Set' || slot.type === 'AI'}
    class:open={slot.type === 'Open'}
    class:current={isCurrent}
>
    <div class="slot-color" style="background-color: {slotColor}"></div>
    
    <div class="slot-info">
        <span class="slot-name">
            <span class="slot-icon">
                {#if slot.type === 'Set'}
                    👤
                {:else if slot.type === 'AI'}
                    🤖
                {:else}
                    🔓
                {/if}
            </span>
            {#if slot.type === 'Set'}
                {slot.name || `Player ${slot.slotIndex + 1}`}
            {:else if slot.type === 'AI'}
                {slot.name || `AI ${slot.slotIndex + 1}`}
            {:else if slot.type === 'Open'}
                <span class="open-text">&lt;Open&gt;</span>
            {/if}
        </span>
        
        {#if slot.type === 'AI' && onDifficultyChange}
            <select
                class="difficulty-select"
                value={slot.difficulty || 'easy'}
                on:change={(e) => onDifficultyChange?.(e.currentTarget.value)}
                on:click|stopPropagation
            >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
            </select>
        {/if}
    </div>
    
    {#if isCurrent}
        <span class="you-badge">YOU</span>
    {/if}
    
    {#if showRemoveButton && onRemove && slot.slotIndex !== 0}
        <button
            class="remove-btn"
            on:click={onRemove}
            title="Remove player"
        >
            ×
        </button>
    {/if}
</div>

<style>
    .player-slot {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        transition: all 0.2s;
    }

    .player-slot.filled {
        border-color: #4c1d95;
    }

    .player-slot.current {
        border-color: #a855f7;
        background: rgba(168, 85, 247, 0.1);
    }

    .player-slot.open {
        border-style: dashed;
    }

    .slot-color {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .slot-info {
        flex: 1;
        min-width: 0;
    }

    .slot-name {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .slot-icon {
        font-size: 1rem;
        flex-shrink: 0;
    }

    .open-text {
        color: #9ca3af;
    }

    .difficulty-select {
        margin-top: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #4b5563;
        border-radius: 4px;
        color: #e5e7eb;
        font-size: 0.75rem;
        cursor: pointer;
        width: 100%;
    }

    .difficulty-select:hover {
        border-color: #6b7280;
    }

    .difficulty-select:focus {
        outline: none;
        border-color: #a855f7;
    }

    .you-badge {
        position: absolute;
        top: -8px;
        right: 8px;
        background: #a855f7;
        color: white;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: bold;
    }

    .remove-btn {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #374151;
        border: 1px solid #4b5563;
        border-radius: 50%;
        color: #9ca3af;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        transition: all 0.2s;
        opacity: 0;
    }

    .player-slot:hover .remove-btn {
        opacity: 1;
    }

    .remove-btn:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: white;
    }
</style>

