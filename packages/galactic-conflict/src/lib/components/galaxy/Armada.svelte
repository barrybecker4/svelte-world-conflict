<script lang="ts">
    import type { Armada, Planet } from '$lib/game/entities/gameTypes';
    import { getArmadaCurrentPosition } from '$lib/game/entities/Armada';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let armada: Armada;
    export let sourcePlanet: Planet;
    export let destinationPlanet: Planet;
    export let currentTime: number = Date.now();

    $: position = getArmadaCurrentPosition(armada, sourcePlanet, destinationPlanet, currentTime);
    $: color = getPlayerColor(armada.ownerId);
    
    // Calculate angle for arrow direction
    $: angle = Math.atan2(
        destinationPlanet.position.y - sourcePlanet.position.y,
        destinationPlanet.position.x - sourcePlanet.position.x
    ) * (180 / Math.PI);
</script>

<g
    class="armada"
    transform="translate({position.x}, {position.y}) rotate({angle})"
>
    <!-- Travel path (faint line to destination) -->
    <line
        x1="0"
        y1="0"
        x2={destinationPlanet.position.x - position.x}
        y2={destinationPlanet.position.y - position.y}
        stroke={color}
        stroke-width="1"
        stroke-dasharray="4 4"
        opacity="0.3"
        transform="rotate({-angle})"
    />

    <!-- Armada ship icon (arrow/triangle) -->
    <polygon
        points="-8,-5 8,0 -8,5"
        fill={color}
        stroke="#ffffff"
        stroke-width="1"
        class="ship-icon"
    />

    <!-- Ship count badge -->
    <g transform="translate(0, -12)">
        <rect
            x="-12"
            y="-8"
            width="24"
            height="14"
            rx="3"
            fill="rgba(0, 0, 0, 0.8)"
            stroke={color}
            stroke-width="1"
        />
        <text
            text-anchor="middle"
            fill="white"
            font-size="10"
            font-weight="bold"
            y="3"
        >
            {armada.ships}
        </text>
    </g>
</g>

<style>
    .armada {
        pointer-events: none;
    }

    .ship-icon {
        animation: glow 0.8s ease-in-out infinite;
    }

    @keyframes glow {
        0%, 100% {
            filter: drop-shadow(0 0 2px currentColor);
        }
        50% {
            filter: drop-shadow(0 0 6px currentColor);
        }
    }
</style>

