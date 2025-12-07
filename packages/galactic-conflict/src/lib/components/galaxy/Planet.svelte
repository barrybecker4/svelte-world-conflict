<script lang="ts">
    import type { Planet } from '$lib/game/entities/gameTypes';
    import { getPlanetRadius } from '$lib/game/entities/Planet';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let planet: Planet;
    export let isSelected: boolean = false;
    export let isOwned: boolean = false;
    export let hasBattle: boolean = false;

    $: radius = getPlanetRadius(planet.volume);
    $: color = getPlayerColor(planet.ownerId);
    $: glowColor = isSelected ? color : 'transparent';
</script>

<g
    class="planet"
    class:selected={isSelected}
    class:owned={isOwned}
    class:battle={hasBattle}
    transform="translate({planet.position.x}, {planet.position.y})"
    role="button"
    tabindex="0"
    on:click
    on:keydown
>
    <!-- Glow effect -->
    {#if isSelected}
        <circle
            r={radius + 8}
            fill="none"
            stroke={glowColor}
            stroke-width="3"
            opacity="0.6"
            class="glow-ring"
        />
    {/if}

    <!-- Battle indicator -->
    {#if hasBattle}
        <circle
            r={radius + 12}
            fill="none"
            stroke="#ef4444"
            stroke-width="2"
            opacity="0.8"
            class="battle-ring"
        />
    {/if}

    <!-- Planet body -->
    <circle
        r={radius}
        fill={color}
        stroke={isSelected ? '#ffffff' : color}
        stroke-width={isSelected ? 2 : 1}
        opacity={planet.ownerId === null ? 0.6 : 1}
    />

    <!-- Planet gradient overlay for 3D effect -->
    <circle
        r={radius}
        fill="url(#planet-gradient)"
        opacity="0.3"
    />

    <!-- Ship count -->
    {#if planet.ships > 0}
        <text
            y="4"
            text-anchor="middle"
            fill="white"
            font-size={Math.max(10, radius * 0.6)}
            font-weight="bold"
            class="ship-count"
        >
            {planet.ships}
        </text>
    {/if}

    <!-- Planet name (shown on hover or selection) -->
    {#if isSelected}
        <text
            y={radius + 16}
            text-anchor="middle"
            fill="#e5e7eb"
            font-size="11"
            class="planet-name"
        >
            {planet.name}
        </text>
    {/if}
</g>

<style>
    .planet {
        cursor: pointer;
        transition: transform 0.2s ease;
    }

    .planet:hover {
        transform: scale(1.05);
    }

    .planet.selected {
        transform: scale(1.1);
    }

    .ship-count {
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }

    .planet-name {
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }

    .glow-ring {
        animation: pulse 1.5s ease-in-out infinite;
    }

    .battle-ring {
        animation: battle-pulse 0.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 0.6;
            transform: scale(1);
        }
        50% {
            opacity: 0.3;
            transform: scale(1.05);
        }
    }

    @keyframes battle-pulse {
        0%, 100% {
            opacity: 0.8;
            stroke-width: 2px;
        }
        50% {
            opacity: 0.4;
            stroke-width: 4px;
        }
    }
</style>

