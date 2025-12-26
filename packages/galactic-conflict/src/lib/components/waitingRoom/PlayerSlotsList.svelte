<script lang="ts">
    import type { PlayerSlot } from '$lib/game/entities/gameTypes';
    import PlayerSlotComponent from '../common/PlayerSlot.svelte';

    export let playerSlots: PlayerSlot[];
    export let currentPlayerId: number | null;
    export let filledSlots: number;
</script>

<section class="players-section">
    <h2>Players ({filledSlots}/{playerSlots.length})</h2>
    <div class="player-grid">
        {#each playerSlots as slot}
            <PlayerSlotComponent
                {slot}
                isCurrent={slot.slotIndex === currentPlayerId}
                showRemoveButton={false}
            />
        {/each}
    </div>
</section>

<style>
    .players-section {
        margin-bottom: 1.5rem;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
    }

    @media (max-width: 640px) {
        .player-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
