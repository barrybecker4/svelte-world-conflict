<script lang="ts">
    import type { Planet } from '$lib/game/entities/gameTypes';

    export let isDragging: boolean;
    export let sourcePlanet: Planet | null;
    export let currentX: number;
    export let currentY: number;
</script>

<!-- Drag line visualization -->
{#if isDragging && sourcePlanet}
    <line
        x1={sourcePlanet.position.x}
        y1={sourcePlanet.position.y}
        x2={currentX}
        y2={currentY}
        stroke="#a78bfa"
        stroke-width="3"
        stroke-dasharray="8 4"
        opacity="0.8"
    />
    <circle
        cx={currentX}
        cy={currentY}
        r="8"
        fill="#a78bfa"
        opacity="0.6"
    />
{/if}
