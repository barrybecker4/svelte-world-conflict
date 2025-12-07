<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { calculateTravelTime } from '$lib/game/entities/Armada';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let sourcePlanet: Planet;
    export let planets: Planet[];
    export let currentPlayerId: number | null = null;
    export let preselectedDestination: Planet | null = null;

    const dispatch = createEventDispatcher();

    let shipCount = 1;
    let selectedDestinationId: number | null = preselectedDestination?.id ?? null;

    // Use fresh planet data from the planets array (it gets updated via polling)
    $: currentSourcePlanet = planets.find(p => p.id === sourcePlanet.id) ?? sourcePlanet;
    $: maxShips = currentSourcePlanet.ships;
    $: stillOwned = currentSourcePlanet.ownerId === currentPlayerId;
    $: availablePlanets = planets.filter(p => p.id !== sourcePlanet.id);
    $: selectedDestination = planets.find(p => p.id === selectedDestinationId);
    
    // Clamp shipCount if maxShips changes
    $: if (shipCount > maxShips) shipCount = Math.max(1, maxShips);
    
    $: travelTimeMs = selectedDestination 
        ? calculateTravelTime(currentSourcePlanet, selectedDestination, GALACTIC_CONSTANTS.DEFAULT_ARMADA_SPEED)
        : 0;
    $: travelTimeSeconds = Math.round(travelTimeMs / 1000);

    function handleSend() {
        if (selectedDestinationId !== null && shipCount > 0 && shipCount <= maxShips) {
            dispatch('send', { 
                shipCount, 
                destinationPlanetId: selectedDestinationId 
            });
        }
    }

    function handleClose() {
        dispatch('close');
    }

    function selectDestination(planetId: number) {
        selectedDestinationId = planetId;
    }
</script>

<div class="modal-overlay" on:click={handleClose} role="button" tabindex="-1" on:keydown>
    <div class="modal" on:click|stopPropagation role="dialog">
        <header>
            <h2>Send Armada</h2>
            <button class="close-btn" on:click={handleClose}>×</button>
        </header>

        <div class="content">
            {#if !stillOwned}
                <div class="ownership-warning">
                    ⚠️ You no longer own this planet! It was conquered.
                </div>
            {/if}
            <div class="source-info" class:lost={!stillOwned}>
                <span class="label">From:</span>
                <span class="planet-name">{currentSourcePlanet.name}</span>
                <span class="ships">({currentSourcePlanet.ships} ships available)</span>
            </div>

            <div class="ship-selection">
                <label for="ship-count">Ships to send:</label>
                <div class="ship-input">
                    <input
                        type="range"
                        id="ship-count"
                        bind:value={shipCount}
                        min="1"
                        max={maxShips}
                    />
                    <input
                        type="number"
                        bind:value={shipCount}
                        min="1"
                        max={maxShips}
                        class="number-input"
                    />
                </div>
                <div class="quick-buttons">
                    <button on:click={() => shipCount = 1}>1</button>
                    <button on:click={() => shipCount = Math.floor(maxShips / 4)}>25%</button>
                    <button on:click={() => shipCount = Math.floor(maxShips / 2)}>50%</button>
                    <button on:click={() => shipCount = maxShips}>All</button>
                </div>
            </div>

            <div class="destination-selection">
                <label>Select destination:</label>
                <div class="planet-list">
                    {#each availablePlanets as planet}
                        {@const isOwned = planet.ownerId === currentPlayerId}
                        {@const isNeutral = planet.ownerId === null}
                        <button
                            class="planet-option"
                            class:selected={selectedDestinationId === planet.id}
                            class:owned={isOwned}
                            class:neutral={isNeutral}
                            class:enemy={!isOwned && !isNeutral}
                            on:click={() => selectDestination(planet.id)}
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

            {#if selectedDestination}
                <div class="travel-info">
                    <p>Travel time: <strong>{travelTimeSeconds}s</strong></p>
                    {#if selectedDestination.ownerId === currentPlayerId}
                        <p class="info-text friendly">Reinforcing friendly planet</p>
                    {:else if selectedDestination.ownerId === null}
                        <p class="info-text neutral">Attacking neutral planet ({selectedDestination.ships} defenders)</p>
                    {:else}
                        <p class="info-text enemy">Attacking enemy planet ({selectedDestination.ships} defenders)</p>
                    {/if}
                </div>
            {/if}
        </div>

        <footer>
            <button class="cancel-btn" on:click={handleClose}>Cancel</button>
            <button
                class="send-btn"
                on:click={handleSend}
                disabled={!stillOwned || selectedDestinationId === null || shipCount < 1 || maxShips < 1}
            >
                {stillOwned ? 'Send Armada' : 'Planet Lost'}
            </button>
        </footer>
    </div>
</div>

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 1px solid #4c1d95;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        color: #e5e7eb;
    }

    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #374151;
    }

    h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #a78bfa;
    }

    .close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .close-btn:hover {
        color: #e5e7eb;
    }

    .content {
        padding: 1.5rem;
    }

    .ownership-warning {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #ef4444;
        color: #fca5a5;
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        text-align: center;
        font-weight: 500;
    }

    .source-info {
        background: rgba(168, 85, 247, 0.1);
        padding: 0.75rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    .source-info.lost {
        background: rgba(239, 68, 68, 0.1);
        opacity: 0.6;
    }

    .label {
        color: #9ca3af;
    }

    .planet-name {
        color: #e5e7eb;
        font-weight: 500;
        margin-left: 0.5rem;
    }

    .ships {
        color: #9ca3af;
        font-size: 0.9rem;
        margin-left: 0.5rem;
    }

    .ship-selection {
        margin-bottom: 1.5rem;
    }

    .ship-selection label {
        display: block;
        margin-bottom: 0.5rem;
        color: #9ca3af;
    }

    .ship-input {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .ship-input input[type="range"] {
        flex: 1;
        accent-color: #a78bfa;
    }

    .number-input {
        width: 60px;
        padding: 0.5rem;
        background: #1f1f2e;
        border: 1px solid #374151;
        border-radius: 4px;
        color: #e5e7eb;
        text-align: center;
    }

    .quick-buttons {
        display: flex;
        gap: 0.5rem;
    }

    .quick-buttons button {
        flex: 1;
        padding: 0.5rem;
        background: #374151;
        border: none;
        border-radius: 4px;
        color: #e5e7eb;
        cursor: pointer;
    }

    .quick-buttons button:hover {
        background: #4b5563;
    }

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

    .planet-option .planet-name {
        flex: 1;
        margin-left: 0;
    }

    .planet-ships {
        color: #9ca3af;
    }

    .travel-info {
        background: rgba(255, 255, 255, 0.05);
        padding: 0.75rem;
        border-radius: 8px;
    }

    .travel-info p {
        margin: 0.25rem 0;
    }

    .info-text {
        font-size: 0.9rem;
    }

    .info-text.friendly {
        color: #22c55e;
    }

    .info-text.neutral {
        color: #9ca3af;
    }

    .info-text.enemy {
        color: #ef4444;
    }

    footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid #374151;
    }

    .cancel-btn {
        padding: 0.75rem 1.5rem;
        background: #374151;
        border: none;
        border-radius: 8px;
        color: #e5e7eb;
        cursor: pointer;
    }

    .cancel-btn:hover {
        background: #4b5563;
    }

    .send-btn {
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .send-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
    }

    .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

