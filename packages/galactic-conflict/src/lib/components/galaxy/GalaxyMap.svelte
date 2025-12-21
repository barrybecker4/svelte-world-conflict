<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { GalacticGameStateData, Planet as PlanetType, PlayerEliminationEvent } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { isGameCompleted, canPlayerInteract } from '$lib/client/utils/gameStateChecks';
    import { extractReplayIds, hasNewReplays } from '$lib/client/utils/eventProcessing';
    import Planet from './Planet.svelte';
    import Armada from './Armada.svelte';
    import BattleAnimationOverlay from './battle-animation/BattleAnimationOverlay.svelte';
    import FloatingTextManager from './FloatingTextManager.svelte';
    import {
        battleAnimations,
        processNewBattleReplays,
        clearAllBattleAnimations,
    } from '$lib/client/stores/battleAnimationStore';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let selectedPlanetId: number | null = null;
    export let hasResigned: boolean = false;
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
    let dragStartTimeout: ReturnType<typeof setTimeout> | null = null;
    let mouseDownX = 0;
    let mouseDownY = 0;

    // Track battle animations to show elimination text after battles
    const pendingEliminationTexts = new Map<number, PlayerEliminationEvent>(); // planetId -> event
    let floatingTextManager: FloatingTextManager;

    // Helper to get drag source planet from current gameState
    function getDragSourcePlanet(): PlanetType | null {
        if (dragSourcePlanetId === null) return null;
        return gameState.planets.find(p => p.id === dragSourcePlanetId) || null;
    }

    // Update time for armada positions (only when game is active)
    function updateTime() {
        // Stop updating time when game is complete - this freezes armadas in place
        if (isGameCompleted(gameState)) {
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
        // Clean up drag timeout
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
        }
        cleanupDrag();
        // Clean up battle animations
        clearAllBattleAnimations();
    });

    function handlePlanetClick(planet: PlanetType) {
        onPlanetClick(planet);
    }

    function handlePlanetMouseDown(planet: PlanetType, event: MouseEvent) {
        // Check if player can interact
        if (!canPlayerInteract(gameState, currentPlayerId, hasResigned)) {
            return;
        }
        // Only allow dragging from owned planets with ships
        if (planet.ownerId !== currentPlayerId || planet.ships <= 0) {
            return;
        }

        // Clear any existing drag timeout to avoid interference with double-clicks
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Store initial mouse position
        mouseDownX = event.clientX;
        mouseDownY = event.clientY;

        // Delay drag start to allow double-click to be detected first
        // If user moves mouse significantly before timeout, start drag immediately
        dragStartTimeout = setTimeout(() => {
            if (dragSourcePlanetId === planet.id) {
                isDragging = true;
                updateDragPosition(event);
                document.addEventListener('mousemove', handleDocumentMouseMove);
                document.addEventListener('mouseup', handleDocumentMouseUp);
            }
        }, 200); // increased delay to allow double-click detection

        dragSourcePlanetId = planet.id;
        updateDragPosition(event);
        
        // Add document-level listeners for mouse move/up to detect actual drag
        document.addEventListener('mousemove', handleDocumentMouseMoveCheck);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    function handleDocumentMouseMoveCheck(event: MouseEvent) {
        // Check if mouse has moved significantly (indicating a drag, not a click)
        const moveThreshold = 5; // pixels
        const dx = Math.abs(event.clientX - mouseDownX);
        const dy = Math.abs(event.clientY - mouseDownY);
        
        if (dx > moveThreshold || dy > moveThreshold) {
            // Mouse moved significantly - this is a drag, start it immediately
            if (dragStartTimeout) {
                clearTimeout(dragStartTimeout);
                dragStartTimeout = null;
            }
            
            if (!isDragging && dragSourcePlanetId !== null) {
                isDragging = true;
                updateDragPosition(event);
                document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);
                document.addEventListener('mousemove', handleDocumentMouseMove);
            }
        }
    }

    function handleDocumentMouseMove(event: MouseEvent) {
        if (!isDragging) return;
        updateDragPosition(event);
    }

    function handleDocumentMouseUp(event: MouseEvent) {
        // Clear the drag start timeout if it's still pending
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }

        // Remove the move check listener
        document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);

        if (!isDragging || dragSourcePlanetId === null) {
            // Important: Don't reset dragSourcePlanetId here yet, as the double-click
            // event may still be pending. Only clear after a short delay or when
            // the double-click handler runs. However, we should cleanup listeners.
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
            
            // Reset drag state after a brief delay to allow double-click to fire
            // This prevents the second mousedown from seeing stale state
            setTimeout(() => {
                if (!isDragging) {
                    dragSourcePlanetId = null;
                }
            }, 50);
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
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }
        isDragging = false;
        dragSourcePlanetId = null;
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mousemove', handleDocumentMouseMoveCheck);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
    }

    function updateDragPosition(event: MouseEvent) {
        if (!svgElement) return;
        
        // Use SVG's built-in coordinate transformation to handle viewBox and preserveAspectRatio correctly
        const point = svgElement.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        
        // Transform from screen coordinates to SVG coordinates
        const screenCTM = svgElement.getScreenCTM();
        if (!screenCTM) return;
        
        const svgPoint = point.matrixTransform(screenCTM.inverse());
        
        dragCurrentX = svgPoint.x;
        dragCurrentY = svgPoint.y;
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
        // Check if player can interact
        if (!canPlayerInteract(gameState, currentPlayerId, hasResigned)) {
            return;
        }
        
        // Cancel any pending drag start or active drag when double-clicking
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }
        
        // Always cleanup drag state on double-click, even if not currently dragging
        cleanupDrag();
        
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

    // Get the display planet state (uses pre-battle state if animation is active)
    function getDisplayPlanet(planet: PlanetType): PlanetType {
        // Check if there's an active battle animation for this planet
        for (const anim of $battleAnimations.values()) {
            if (anim.replay.planetId === planet.id && anim.preBattlePlanetState) {
                // Once outcome is shown, reveal the actual battle result
                // The overlay can stay visible, but planet should update immediately
                // Update when animation phase is 'outcome' or 'done'
                if (anim.phase === 'outcome' || anim.phase === 'done') {
                    // Show post-battle state (actual planet state from gameState)
                    return planet;
                }
                // Return planet with pre-battle state to preserve suspense during animation
                return {
                    ...planet,
                    ownerId: anim.preBattlePlanetState.ownerId,
                    ships: anim.preBattlePlanetState.ships,
                };
            }
        }
        // No active animation - always show actual planet state
        // (This handles the case where the animation was removed and the planet should show the final state)
        return planet;
    }
    
    // Process battle replays whenever they change
    let lastReplayIds: string[] = [];
    $: {
        const replays = gameState.recentBattleReplays ?? [];
        const currentReplayIds = extractReplayIds(replays);
        const hasNew = hasNewReplays(currentReplayIds, lastReplayIds);
        
        console.log(`[GalaxyMap] Checking battle replays:`, {
            count: replays.length,
            planetNames: replays.map(r => r.planetName),
            replayIds: currentReplayIds,
            lastReplayIds: lastReplayIds,
            hasNewReplays: hasNew,
            gameStateReference: gameState,
        });
        
        if (replays.length > 0 && hasNew) {
            console.log(`[GalaxyMap] Processing ${replays.length} battle replays (${replays.length - lastReplayIds.length} new)`);
            processNewBattleReplays(replays);
            lastReplayIds = currentReplayIds;
        } else if (replays.length === 0 && lastReplayIds.length > 0) {
            console.log(`[GalaxyMap] Battle replays cleared from state, but animations continue`);
            lastReplayIds = [];
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
            {#key $battleAnimations}
                {@const displayPlanet = getDisplayPlanet(planet)}
                {@const isOwned = displayPlanet.ownerId === currentPlayerId}
                {@const canMovePlanet = isOwned && displayPlanet.ships > 0}
                <Planet
                    planet={displayPlanet}
                    isSelected={selectedPlanetId === planet.id}
                    {isOwned}
                    canMove={canMovePlanet}
                    hasBattle={hasAnimationAtPlanet(planet.id)}
                    on:click={() => handlePlanetClick(planet)}
                    on:mousedown={(e) => handlePlanetMouseDown(planet, e)}
                    on:dblclick={() => handlePlanetDoubleClick(planet)}
                />
            {/key}
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

<!-- Floating Text Manager -->
<FloatingTextManager
    bind:this={floatingTextManager}
    {gameState}
    svgElement={svgElement}
    battleAnimations={$battleAnimations}
    {pendingEliminationTexts}
/>

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
