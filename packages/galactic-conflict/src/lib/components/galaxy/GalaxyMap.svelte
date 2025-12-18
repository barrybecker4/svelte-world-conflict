<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { GalacticGameStateData, Planet as PlanetType } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import Planet from './Planet.svelte';
    import Armada from './Armada.svelte';
    import BattleAnimationOverlay from './BattleAnimationOverlay.svelte';
    import {
        battleAnimations,
        processNewBattleReplays,
        clearAllBattleAnimations,
    } from '$lib/client/stores/battleAnimationStore';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let selectedPlanetId: number | null = null;
    export let onPlanetClick: (planet: PlanetType) => void = () => {};

    const dispatch = createEventDispatcher<{
        dragSend: { sourcePlanet: PlanetType; destinationPlanet: PlanetType };
        doubleClick: { planet: PlanetType };
    }>();

    let currentTime = Date.now();
    let animationFrame: number;

    // Drag state - store planet ID instead of object to survive re-renders
    let isDragging = false;
    let dragSourcePlanetId: number | null = null;
    let dragCurrentX = 0;
    let dragCurrentY = 0;
    let svgElement: SVGSVGElement;

    // Helper to get drag source planet from current gameState
    function getDragSourcePlanet(): PlanetType | null {
        if (dragSourcePlanetId === null) return null;
        return gameState.planets.find(p => p.id === dragSourcePlanetId) || null;
    }

    // Update time for armada positions (only when game is active)
    function updateTime() {
        // Stop updating time when game is complete - this freezes armadas in place
        if (gameState.status === 'COMPLETED') {
            return;
        }
        currentTime = Date.now();
        animationFrame = requestAnimationFrame(updateTime);
    }

    onMount(() => {
        updateTime();
        
        // Process any existing battle replays when component mounts
        if (gameState.recentBattleReplays?.length > 0) {
            console.log(`[GalaxyMap] Mount: ${gameState.recentBattleReplays.length} battle replays to play`);
            processNewBattleReplays(gameState.recentBattleReplays);
        }
    });

    onDestroy(() => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        // Clean up battle animations
        clearAllBattleAnimations();
    });

    function handlePlanetClick(planet: PlanetType) {
        onPlanetClick(planet);
    }

    function handlePlanetMouseDown(planet: PlanetType, event: MouseEvent) {
        // Only allow dragging from owned planets with ships
        if (planet.ownerId !== currentPlayerId || planet.ships <= 0) {
            return;
        }

        isDragging = true;
        dragSourcePlanetId = planet.id;
        updateDragPosition(event);
        
        // Add document-level listeners for drag
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    function handleDocumentMouseMove(event: MouseEvent) {
        if (!isDragging) return;
        updateDragPosition(event);
    }

    function handleDocumentMouseUp(event: MouseEvent) {
        if (!isDragging || dragSourcePlanetId === null) {
            cleanupDrag();
            return;
        }

        // Look up source planet from current gameState (always fresh)
        const sourcePlanet = getDragSourcePlanet();
        if (!sourcePlanet) {
            cleanupDrag();
            return;
        }

        // Find if we're over a planet
        const targetPlanet = findPlanetAtPosition(dragCurrentX, dragCurrentY);
        
        if (targetPlanet && targetPlanet.id !== sourcePlanet.id) {
            // Dispatch drag send event
            dispatch('dragSend', {
                sourcePlanet: sourcePlanet,
                destinationPlanet: targetPlanet
            });
        }

        cleanupDrag();
    }

    function cleanupDrag() {
        isDragging = false;
        dragSourcePlanetId = null;
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
    }

    function updateDragPosition(event: MouseEvent) {
        if (!svgElement) return;
        
        const rect = svgElement.getBoundingClientRect();
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        
        dragCurrentX = (event.clientX - rect.left) * scaleX;
        dragCurrentY = (event.clientY - rect.top) * scaleY;
    }

    function findPlanetAtPosition(x: number, y: number): PlanetType | undefined {
        // Find planet within click radius
        const clickRadius = 30;
        return gameState.planets.find(planet => {
            const dx = planet.position.x - x;
            const dy = planet.position.y - y;
            return Math.sqrt(dx * dx + dy * dy) < clickRadius;
        });
    }

    function handlePlanetDoubleClick(planet: PlanetType) {
        if (planet.ownerId === currentPlayerId) {
            dispatch('doubleClick', { planet });
        }
    }

    function getPlanetById(id: number): PlanetType | undefined {
        return gameState.planets.find(p => p.id === id);
    }

    // Check if there's an active animation at a planet
    function hasAnimationAtPlanet(planetId: number): boolean {
        for (const anim of $battleAnimations.values()) {
            if (anim.replay.planetId === planetId) {
                return true;
            }
        }
        return false;
    }
    
    // Process battle replays whenever they change
    $: {
        const replays = gameState.recentBattleReplays ?? [];
        console.log(`[GalaxyMap] Checking battle replays: ${replays.length}`, replays.map(r => r.planetName));
        if (replays.length > 0) {
            processNewBattleReplays(replays);
        }
    }

    $: width = GALACTIC_CONSTANTS.GALAXY_WIDTH;
    $: height = GALACTIC_CONSTANTS.GALAXY_HEIGHT;
</script>

<div class="galaxy-container">
    <svg
        bind:this={svgElement}
        viewBox="0 0 {width} {height}"
        preserveAspectRatio="xMidYMid meet"
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
            {@const isOwned = planet.ownerId === currentPlayerId}
            {@const canMovePlanet = isOwned && planet.ships > 0}
            <Planet
                {planet}
                isSelected={selectedPlanetId === planet.id}
                {isOwned}
                canMove={canMovePlanet}
                hasBattle={hasAnimationAtPlanet(planet.id)}
                on:click={() => handlePlanetClick(planet)}
                on:mousedown={(e) => handlePlanetMouseDown(planet, e)}
                on:dblclick={() => handlePlanetDoubleClick(planet)}
            />
        {/each}

        <!-- Battle Animations -->
        {#each [...$battleAnimations.values()] as animationState (animationState.replay.id)}
            {@const battlePlanet = gameState.planets.find(p => p.id === animationState.replay.planetId)}
            {#if battlePlanet}
                <BattleAnimationOverlay
                    {animationState}
                    planet={battlePlanet}
                />
            {/if}
        {/each}

        <!-- Drag line visualization -->
        {#if isDragging && dragSourcePlanetId !== null}
            {@const sourcePlanet = getDragSourcePlanet()}
            {#if sourcePlanet}
                <line
                    x1={sourcePlanet.position.x}
                    y1={sourcePlanet.position.y}
                    x2={dragCurrentX}
                    y2={dragCurrentY}
                    stroke="#a78bfa"
                    stroke-width="3"
                    stroke-dasharray="8 4"
                    opacity="0.8"
                />
                <circle
                    cx={dragCurrentX}
                    cy={dragCurrentY}
                    r="8"
                    fill="#a78bfa"
                    opacity="0.6"
                />
            {/if}
        {/if}
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
        width: 100%;
        height: 100%;
        user-select: none;
    }
</style>
