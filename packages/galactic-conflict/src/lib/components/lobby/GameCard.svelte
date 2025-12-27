<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let game: any;

    $: playerCount = game.players?.length || game.playerSlots?.length || 0;
    $: neutralPlanets = game.settings?.neutralPlanetCount ?? 8;
    $: totalPlanets = playerCount + neutralPlanets;
    $: openSlots = game.playerSlots?.filter((s: any) => s.type === 'Open') || [];

    function handleJoinSlot(slotIndex: number) {
        dispatch('join', { gameId: game.gameId, slotIndex });
    }
</script>

<div class="game-card">
    <div class="game-info">
        <span class="game-id">Game: {game.gameId}</span>
        <span class="player-count">
            {game.players?.length || 0}/{game.playerSlots?.length || 0} players
        </span>
    </div>
    <div class="settings-preview">
        <span>🪐 {totalPlanets} planets ({neutralPlanets} neutral)</span>
        <span>⏱️ {game.settings?.gameDuration || 15}min</span>
    </div>
    <div class="slots">
        {#each openSlots as slot}
            <button
                class="slot-btn"
                on:click={() => handleJoinSlot(slot.slotIndex)}
            >
                Join Slot {slot.slotIndex + 1}
            </button>
        {/each}
    </div>
</div>

<style>
    .game-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 1rem;
    }

    .game-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .game-id {
        font-weight: 500;
    }

    .player-count {
        color: #9ca3af;
    }

    .settings-preview {
        display: flex;
        gap: 1rem;
        font-size: 0.85rem;
        color: #9ca3af;
        margin-bottom: 0.75rem;
    }

    .slots {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .slot-btn {
        padding: 0.5rem 1rem;
        background: #374151;
        border: none;
        border-radius: 4px;
        color: #e5e7eb;
        cursor: pointer;
        font-size: 0.85rem;
    }

    .slot-btn:hover {
        background: #4b5563;
    }
</style>
