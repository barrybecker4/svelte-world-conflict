<script lang="ts">
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';

    export let neutralPlanetCount: number;
    export let gameDuration: number;
    export let armadaSpeed: number;
    export let productionRate: number;
    export let neutralShipsMin: number;
    export let neutralShipsMultiplierMax: number;
    export let playerCount: number;
</script>

<section class="settings-section">
    <h2>Galaxy Settings</h2>
    
    <div class="setting-row">
        <label for="neutral-planet-count">
            <span class="label-text">Neutral Planets</span>
            <span class="label-value">{neutralPlanetCount}</span>
        </label>
        <input
            type="range"
            id="neutral-planet-count"
            bind:value={neutralPlanetCount}
            min={0}
            max={GALACTIC_CONSTANTS.MAX_NEUTRAL_PLANETS}
            step="1"
        />
        <span class="tooltip">Number of neutral planets to conquer. Total planets = players ({playerCount}) + neutral planets ({neutralPlanetCount}).</span>
    </div>

    <div class="setting-row">
        <label for="game-duration">
            <span class="label-text">Duration</span>
            <span class="label-value">{gameDuration} min</span>
        </label>
        <input
            type="range"
            id="game-duration"
            bind:value={gameDuration}
            min={GALACTIC_CONSTANTS.GAME_DURATION_MIN_MINUTES}
            max={GALACTIC_CONSTANTS.GAME_DURATION_MAX_MINUTES}
            step="1"
        />
        <span class="tooltip">How long the game lasts. Player with most ships when time expires wins.</span>
    </div>

    <div class="setting-row">
        <label for="armada-speed">
            <span class="label-text">Armada Speed</span>
            <span class="label-value">{armadaSpeed}</span>
        </label>
        <input
            type="range"
            id="armada-speed"
            bind:value={armadaSpeed}
            min={GALACTIC_CONSTANTS.ARMADA_SPEED_MIN}
            max={GALACTIC_CONSTANTS.ARMADA_SPEED_MAX}
            step="10"
        />
        <span class="tooltip">Fleet travel speed (units/min). Higher = faster reinforcements and attacks.</span>
    </div>

    <div class="setting-row">
        <label for="production-rate">
            <span class="label-text">Production</span>
            <span class="label-value">{productionRate}x</span>
        </label>
        <input
            type="range"
            id="production-rate"
            bind:value={productionRate}
            min={GALACTIC_CONSTANTS.PRODUCTION_RATE_MIN}
            max={GALACTIC_CONSTANTS.PRODUCTION_RATE_MAX}
            step="0.5"
        />
        <span class="tooltip">Resources per planet volume per minute. Higher = faster ship production.</span>
    </div>

    <div class="setting-row">
        <label for="neutral-ships-min">
            <span class="label-text">Neutral Min</span>
            <span class="label-value">{neutralShipsMin}</span>
        </label>
        <input
            type="range"
            id="neutral-ships-min"
            bind:value={neutralShipsMin}
            min={0}
            max={50}
            step="1"
        />
        <span class="tooltip">Minimum defenders on neutral planets. Higher = harder early expansion.</span>
    </div>

    <div class="setting-row">
        <label for="neutral-ships-multiplier">
            <span class="label-text">Neutral Max</span>
            <span class="label-value">{neutralShipsMultiplierMax}x</span>
        </label>
        <input
            type="range"
            id="neutral-ships-multiplier"
            bind:value={neutralShipsMultiplierMax}
            min={0}
            max={5}
            step="0.5"
        />
        <span class="tooltip">Max defender scaling by planet size. Higher = bigger planets have more defenders.</span>
    </div>
</section>

<style>
    .settings-section {
        margin-bottom: 1.5rem;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .setting-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.75rem;
        position: relative;
    }

    .setting-row label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 160px;
        flex-shrink: 0;
        gap: 0.5rem;
    }

    .label-text {
        color: #e5e7eb;
        font-size: 0.9rem;
    }

    .label-value {
        color: #a78bfa;
        font-weight: bold;
        font-size: 0.85rem;
        min-width: 50px;
        text-align: right;
    }

    .setting-row input[type="range"] {
        flex: 1;
        accent-color: #a78bfa;
        height: 6px;
    }

    .tooltip {
        position: absolute;
        left: 0;
        top: 100%;
        margin-top: 4px;
        background: #1f2937;
        color: #d1d5db;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.75rem;
        white-space: normal;
        max-width: 300px;
        z-index: 100;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        border: 1px solid #374151;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        line-height: 1.4;
        pointer-events: none;
    }

    .setting-row:hover .tooltip {
        opacity: 1;
        visibility: visible;
    }
</style>
