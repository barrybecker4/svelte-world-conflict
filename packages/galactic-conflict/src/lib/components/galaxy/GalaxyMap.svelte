<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { GalacticGameStateData, Planet as PlanetType, Armada as ArmadaType } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import Planet from './Planet.svelte';
    import Armada from './Armada.svelte';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let selectedPlanetId: number | null = null;
    export let onPlanetClick: (planet: PlanetType) => void = () => {};

    let currentTime = Date.now();
    let animationFrame: number;

    // Update time for armada positions
    function updateTime() {
        currentTime = Date.now();
        animationFrame = requestAnimationFrame(updateTime);
    }

    onMount(() => {
        updateTime();
    });

    onDestroy(() => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    });

    function handlePlanetClick(planet: PlanetType) {
        onPlanetClick(planet);
    }

    function getPlanetById(id: number): PlanetType | undefined {
        return gameState.planets.find(p => p.id === id);
    }

    function hasBattleAtPlanet(planetId: number): boolean {
        return gameState.activeBattles.some(b => b.planetId === planetId && b.status === 'active');
    }

    $: width = GALACTIC_CONSTANTS.GALAXY_WIDTH;
    $: height = GALACTIC_CONSTANTS.GALAXY_HEIGHT;
</script>

<div class="galaxy-container">
    <svg
        {width}
        {height}
        viewBox="0 0 {width} {height}"
        class="galaxy-map"
    >
        <!-- Definitions -->
        <defs>
            <!-- Planet gradient for 3D effect -->
            <radialGradient id="planet-gradient" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stop-color="white" />
                <stop offset="100%" stop-color="transparent" />
            </radialGradient>

            <!-- Star field pattern -->
            <pattern id="stars" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="0.5" fill="white" opacity="0.5" />
                <circle cx="50" cy="30" r="0.3" fill="white" opacity="0.3" />
                <circle cx="80" cy="60" r="0.4" fill="white" opacity="0.4" />
                <circle cx="30" cy="80" r="0.3" fill="white" opacity="0.3" />
                <circle cx="70" cy="90" r="0.5" fill="white" opacity="0.5" />
                <circle cx="90" cy="20" r="0.3" fill="white" opacity="0.4" />
                <circle cx="20" cy="50" r="0.4" fill="white" opacity="0.3" />
            </pattern>

            <!-- Glow filter -->
            <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <!-- Background -->
        <rect width="100%" height="100%" fill="#0a0a14" />
        <rect width="100%" height="100%" fill="url(#stars)" />

        <!-- Armadas (draw first so they appear behind planets) -->
        {#each gameState.armadas as armada (armada.id)}
            {@const sourcePlanet = getPlanetById(armada.sourcePlanetId)}
            {@const destPlanet = getPlanetById(armada.destinationPlanetId)}
            {#if sourcePlanet && destPlanet}
                <Armada
                    {armada}
                    {sourcePlanet}
                    destinationPlanet={destPlanet}
                    {currentTime}
                />
            {/if}
        {/each}

        <!-- Planets -->
        {#each gameState.planets as planet (planet.id)}
            <Planet
                {planet}
                isSelected={selectedPlanetId === planet.id}
                isOwned={planet.ownerId === currentPlayerId}
                hasBattle={hasBattleAtPlanet(planet.id)}
                on:click={() => handlePlanetClick(planet)}
            />
        {/each}
    </svg>
</div>

<style>
    .galaxy-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 100%);
    }

    .galaxy-map {
        max-width: 100%;
        max-height: 100%;
        user-select: none;
    }
</style>

