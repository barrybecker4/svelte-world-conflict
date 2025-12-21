<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { calculateTravelTime } from '$lib/game/entities/Armada';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { audioSystem, SOUNDS } from '$lib/client/audio';
    import ShipCountSelector from './send-armada/ShipCountSelector.svelte';
    import DestinationPlanetList from './send-armada/DestinationPlanetList.svelte';

    export let sourcePlanet: Planet;
    export let planets: Planet[];
    export let currentPlayerId: number | null = null;
    export let preselectedDestination: Planet | null = null;

    const dispatch = createEventDispatcher();

    let shipCount = 1;
    let selectedDestinationId: number | null = preselectedDestination?.id ?? null;
    let initialShips: number | null = null;
    let isSending = false;

    // Track initial ships on mount to detect if all ships were sent
    onMount(() => {
        const planet = planets.find(p => p.id === sourcePlanet.id);
        initialShips = planet?.ships ?? sourcePlanet.ships;
    });

    // Use fresh planet data from the planets array (it gets updated via polling)
    $: currentSourcePlanet = planets.find(p => p.id === sourcePlanet.id) ?? sourcePlanet;
    $: maxShips = currentSourcePlanet.ships;
    $: stillOwned = currentSourcePlanet.ownerId === currentPlayerId;
    $: availablePlanets = planets.filter(p => p.id !== sourcePlanet.id);
    $: selectedDestination = planets.find(p => p.id === selectedDestinationId);
    
    // Auto-close if all ships were sent (ships went from >0 to 0 while still owned)
    $: if (initialShips !== null && initialShips > 0 && maxShips === 0 && stillOwned) {
        // Small delay to let the send complete, then auto-close
        setTimeout(() => dispatch('close'), 100);
    }
    
    // For slider min/max - ensure min <= max to avoid invalid range that breaks the browser
    $: sliderMax = Math.max(1, maxShips);
    $: sliderMin = maxShips > 0 ? 1 : 0;
    
    // Clamp shipCount if maxShips changes
    $: if (maxShips <= 0) {
        shipCount = 0;
    } else if (shipCount > maxShips) {
        shipCount = maxShips;
    } else if (shipCount < 1) {
        shipCount = 1;
    }
    
    $: travelTimeMs = selectedDestination 
        ? calculateTravelTime(currentSourcePlanet, selectedDestination, GALACTIC_CONSTANTS.DEFAULT_ARMADA_SPEED)
        : 0;
    $: travelTimeSeconds = Math.round(travelTimeMs / 1000);

    function handleSend() {
        if (isSending) return; // Prevent multiple clicks
        if (selectedDestinationId !== null && shipCount > 0 && shipCount <= maxShips) {
            isSending = true;
            audioSystem.playSound(SOUNDS.SHIP_LAUNCH);
            dispatch('send', { 
                shipCount, 
                destinationPlanetId: selectedDestinationId 
            });
        }
    }

    function handleClose() {
        isSending = false;
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

            <ShipCountSelector
                bind:shipCount
                {maxShips}
                {sliderMin}
                {sliderMax}
            />

            <DestinationPlanetList
                planets={availablePlanets}
                sourcePlanetId={sourcePlanet.id}
                {currentPlayerId}
                {selectedDestinationId}
                onSelect={selectDestination}
            />

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
                disabled={isSending || !stillOwned || selectedDestinationId === null || shipCount < 1 || maxShips < 1}
            >
                {isSending ? 'Sending...' : stillOwned ? 'Send Armada' : 'Planet Lost'}
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

