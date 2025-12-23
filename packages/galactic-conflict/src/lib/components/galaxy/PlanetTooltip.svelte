<script lang="ts">
    import type { Planet, Player } from '$lib/game/entities/gameTypes';
    import { getPlanetProduction } from '$lib/game/entities/Planet';

    export let planet: Planet;
    export let players: Player[];
    export let productionRate: number;
    export let x: number = 0;
    export let y: number = 0;

    $: owner = planet.ownerId !== null 
        ? players.find(p => p.slotIndex === planet.ownerId)?.name || 'Unknown'
        : 'Neutral';
    
    $: production = (getPlanetProduction(planet.volume) * productionRate).toFixed(1);
</script>

<foreignObject {x} {y} width="140" height="100" class="tooltip-container">
    <div class="tooltip">
        <div class="tooltip-header">{planet.name}</div>
        <div class="tooltip-row">
            <span class="label">Owner:</span>
            <span class="value">{owner}</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Production:</span>
            <span class="value">{production}/min</span>
        </div>
        <div class="tooltip-row">
            <span class="label">Ships:</span>
            <span class="value">{planet.ships}</span>
        </div>
    </div>
</foreignObject>

<style>
    .tooltip-container {
        pointer-events: none;
        overflow: visible;
    }

    .tooltip {
        background: rgba(17, 24, 39, 0.95);
        border: 1px solid rgba(75, 85, 99, 0.8);
        border-radius: 4px;
        padding: 6px 8px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        color: #e5e7eb;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(8px);
        width: 130px;
    }

    .tooltip-header {
        color: #60a5fa;
        font-weight: 600;
        font-size: 12px;
        padding-bottom: 4px;
        margin-bottom: 4px;
        border-bottom: 1px solid rgba(75, 85, 99, 0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tooltip-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        gap: 8px;
    }

    .label {
        color: #9ca3af;
        font-weight: 500;
        flex-shrink: 0;
    }

    .value {
        color: #f3f4f6;
        font-weight: 600;
        text-align: right;
        white-space: nowrap;
    }
</style>

