<script lang="ts">
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let planets: Planet[];
    export let sourcePlanetId: number;
    export let currentPlayerId: number | null;
    export let selectedDestinationId: number | null;
    export let onSelect: (planetId: number) => void;
</script>

<div class="destination-selection">
    <label>Select destination:</label>
    <div class="planet-list">
        {#each planets as planet}
            {@const isOwned = planet.ownerId === currentPlayerId}
            {@const isNeutral = planet.ownerId === null}
            <button
                class="planet-option"
                class:selected={selectedDestinationId === planet.id}
                class:owned={isOwned}
                class:neutral={isNeutral}
                class:enemy={!isOwned && !isNeutral}
                on:click={() => onSelect(planet.id)}
            >
                <span 
                    class="planet-color"
                    style="background-color: {getPlayerColor(planet.ownerId)}"
                ></span>
                <span class="planet-name">{planet.name}</span>
                <span class="planet-ships">{planet.ships}🚀</span>
            </button>
        {/each}
    </div>
</div>

<style>
    .destination-selection {
        margin-bottom: 1.5rem;
    }

    .destination-selection label {
        display: block;
        margin-bottom: 0.5rem;
        color: #9ca3af;
    }

    .planet-list {
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .planet-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: #e5e7eb;
        text-align: left;
    }

    .planet-option:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .planet-option.selected {
        border-color: #a78bfa;
        background: rgba(168, 85, 247, 0.2);
    }

    .planet-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }

    .planet-name {
        flex: 1;
        margin-left: 0;
    }

    .planet-ships {
        color: #9ca3af;
    }
</style>
