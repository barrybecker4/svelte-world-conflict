<script lang="ts">
    export let shipCount: number;
    export let maxShips: number;
    export let sliderMin: number;
    export let sliderMax: number;
</script>

<div class="ship-selection">
    <label for="ship-count">Ships to send:</label>
    {#if maxShips <= 0}
        <div class="no-ships-warning">No ships available to send!</div>
    {:else}
        <div class="ship-input">
            <input
                type="range"
                id="ship-count"
                bind:value={shipCount}
                min={sliderMin}
                max={sliderMax}
            />
            <input
                type="number"
                bind:value={shipCount}
                min={sliderMin}
                max={sliderMax}
                class="number-input"
            />
        </div>
        <div class="quick-buttons">
            <button on:click={() => shipCount = 1}>1</button>
            <button on:click={() => shipCount = Math.max(1, Math.floor(maxShips / 4))}>25%</button>
            <button on:click={() => shipCount = Math.max(1, Math.floor(maxShips / 2))}>50%</button>
            <button on:click={() => shipCount = maxShips}>All</button>
        </div>
    {/if}
</div>

<style>
    .ship-selection {
        margin-bottom: 1.5rem;
    }

    .ship-selection label {
        display: block;
        margin-bottom: 0.5rem;
        color: #9ca3af;
    }

    .no-ships-warning {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
        padding: 0.75rem;
        border-radius: 6px;
        text-align: center;
        font-size: 0.9rem;
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
</style>

