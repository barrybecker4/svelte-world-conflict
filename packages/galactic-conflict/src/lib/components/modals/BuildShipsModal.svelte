<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { audioSystem, SOUNDS } from '$lib/client/audio';

    export let planet: Planet;
    export let planets: Planet[] = [];
    export let currentPlayerId: number | null = null;
    export let playerResources: number = 0;

    const dispatch = createEventDispatcher();

    let shipCount = 1;
    let hasInitialized = false;

    // Use fresh planet data from the planets array (it gets updated via polling)
    $: currentPlanet = planets.find(p => p.id === planet.id) ?? planet;
    $: stillOwned = currentPlanet.ownerId === currentPlayerId;
    $: shipCost = GALACTIC_CONSTANTS.SHIP_COST;
    $: totalCost = shipCount * shipCost;
    $: maxAffordable = Math.floor(playerResources / shipCost);
    $: canAfford = playerResources >= totalCost;
    
    // Initialize shipCount to maxAffordable on first render
    $: if (!hasInitialized && maxAffordable > 0) {
        shipCount = maxAffordable;
        hasInitialized = true;
    }
    
    // Clamp shipCount if maxAffordable changes
    $: if (shipCount > maxAffordable && maxAffordable > 0) shipCount = maxAffordable;

    function handleBuild() {
        if (canAfford && shipCount > 0) {
            audioSystem.playSound(SOUNDS.SHIP_BUILT);
            dispatch('build', { shipCount });
        }
    }

    function handleClose() {
        dispatch('close');
    }
</script>

<div class="modal-overlay" on:click={handleClose} role="button" tabindex="-1" on:keydown>
    <div class="modal" on:click|stopPropagation role="dialog">
        <header>
            <h2>Build Ships</h2>
            <button class="close-btn" on:click={handleClose}>×</button>
        </header>

        <div class="content">
            {#if !stillOwned}
                <div class="ownership-warning">
                    ⚠️ You no longer own this planet! It was conquered.
                </div>
            {/if}
            <div class="planet-info" class:lost={!stillOwned}>
                <h3>{currentPlanet.name}</h3>
                <div class="stats">
                    <div class="stat">
                        <span class="stat-label">Ships on Planet</span>
                        <span class="stat-value">{currentPlanet.ships} → <span class="result-value">{currentPlanet.ships + shipCount}</span></span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Your Resources</span>
                        <span class="stat-value">{Math.floor(playerResources)} → <span class="result-value">{Math.floor(playerResources) - totalCost}</span></span>
                    </div>
                </div>
            </div>

            <div class="build-section">
                <div class="cost-info">
                    <span>Cost per ship:</span>
                    <span class="cost-value">{shipCost} resources</span>
                </div>

                <div class="ship-selection">
                    <label for="ship-count">Ships to build:</label>
                    <div class="ship-input">
                        <input
                            type="range"
                            id="ship-count"
                            bind:value={shipCount}
                            min="1"
                            max={Math.max(1, maxAffordable)}
                        />
                        <input
                            type="number"
                            bind:value={shipCount}
                            min="1"
                            max={maxAffordable}
                            class="number-input"
                        />
                    </div>
                </div>
            </div>
        </div>

        <footer>
            <button class="cancel-btn" on:click={handleClose}>Cancel</button>
            <button
                class="build-btn"
                on:click={handleBuild}
                disabled={!stillOwned || !canAfford || shipCount < 1}
            >
                {stillOwned ? `Build ${shipCount} Ship${shipCount !== 1 ? 's' : ''}` : 'Planet Lost'}
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
        max-width: 400px;
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

    h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        color: #e5e7eb;
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

    .planet-info {
        background: rgba(168, 85, 247, 0.1);
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1.5rem;
    }

    .planet-info.lost {
        background: rgba(239, 68, 68, 0.1);
        opacity: 0.6;
    }

    .stats {
        display: flex;
        gap: 1.5rem;
    }

    .stat {
        display: flex;
        flex-direction: column;
    }

    .stat-label {
        font-size: 0.8rem;
        color: #9ca3af;
    }

    .stat-value {
        font-size: 1.25rem;
        font-weight: bold;
    }

    .result-value {
        color: #22c55e;
    }

    .build-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .cost-info {
        display: flex;
        justify-content: space-between;
        color: #9ca3af;
        font-size: 0.9rem;
    }

    .cost-value {
        color: #fbbf24;
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

    .build-btn {
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .build-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #16a34a, #15803d);
    }

    .build-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

