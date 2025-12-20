<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { GalacticGameStateData, Planet as PlanetType, ReinforcementEvent, ConquestEvent, PlayerEliminationEvent } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import Planet from './Planet.svelte';
    import Armada from './Armada.svelte';
    import BattleAnimationOverlay from './battle-animation/BattleAnimationOverlay.svelte';
    import FloatingTextMessage from './FloatingTextMessage.svelte';
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

    // Floating text messages
    interface FloatingText {
        id: string;
        x: number;
        y: number;
        text: string;
        color: string;
    }
    let floatingTexts: FloatingText[] = [];
    const processedEventIds = new Set<string>();
    
    // Track battle animations to show elimination text after battles
    const pendingEliminationTexts = new Map<number, PlayerEliminationEvent>(); // planetId -> event

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
        // Don't allow dragging if player has resigned
        if (hasResigned) {
            return;
        }
        // Don't allow dragging if player is eliminated (resigned or defeated)
        if (currentPlayerId !== null && gameState.eliminatedPlayers?.includes(currentPlayerId)) {
            return;
        }
        // Only allow dragging from owned planets with ships
        if (planet.ownerId !== currentPlayerId || planet.ships <= 0) {
            return;
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
        }, 100); // delay to allow double-click detection

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
        // Don't allow building if player has resigned
        if (hasResigned) {
            return;
        }
        // Don't allow building if player is eliminated (resigned or defeated)
        if (currentPlayerId !== null && gameState.eliminatedPlayers?.includes(currentPlayerId)) {
            return;
        }
        
        // Cancel any pending drag start or active drag when double-clicking
        if (dragStartTimeout) {
            clearTimeout(dragStartTimeout);
            dragStartTimeout = null;
        }
        if (isDragging) {
            cleanupDrag();
        }
        
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
                // Also update immediately if game has ended (status === 'COMPLETED')
                if (anim.phase === 'outcome' || anim.phase === 'done' || gameState.status === 'COMPLETED') {
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
        // No active animation, return planet as-is
        return planet;
    }
    
    // Process battle replays whenever they change
    // Track the replay IDs to detect new ones even if array reference doesn't change
    // Don't clear animations when replays are cleared from state - animations continue independently
    let lastReplayIds: string[] = [];
    $: {
        const replays = gameState.recentBattleReplays ?? [];
        const currentReplayIds = replays.map(r => r.id);
        const hasNewReplays = currentReplayIds.some(id => !lastReplayIds.includes(id));
        
        console.log(`[GalaxyMap] Checking battle replays:`, {
            count: replays.length,
            planetNames: replays.map(r => r.planetName),
            replayIds: currentReplayIds,
            lastReplayIds: lastReplayIds,
            hasNewReplays: hasNewReplays,
            gameStateReference: gameState,
        });
        
        if (replays.length > 0 && hasNewReplays) {
            console.log(`[GalaxyMap] Processing ${replays.length} battle replays (${replays.length - lastReplayIds.length} new)`);
            processNewBattleReplays(replays);
            lastReplayIds = currentReplayIds;
        } else if (replays.length === 0 && lastReplayIds.length > 0) {
            // Replays were cleared from state, but don't interrupt ongoing animations
            // The animations will complete on their own
            console.log(`[GalaxyMap] Battle replays cleared from state, but animations continue`);
            lastReplayIds = [];
        }
    }
    
    // Watch for battle animations closing - show elimination text if pending
    $: {
        const activeAnimations = [...$battleAnimations.values()];
        const activePlanetIds = new Set(activeAnimations.map(a => a.replay.planetId));
        
        // Check for elimination events at planets that no longer have active battles
        for (const [planetId, event] of pendingEliminationTexts.entries()) {
            if (!activePlanetIds.has(planetId)) {
                // Battle is done, show elimination text
                const planet = gameState.planets.find(p => p.id === planetId);
                if (planet) {
                    showEliminationText(event, planet);
                    pendingEliminationTexts.delete(planetId);
                }
            }
        }
    }

    // Process reinforcement and conquest events
    function getScreenCoords(planet: PlanetType): { x: number; y: number } {
        if (!svgElement) return { x: 0, y: 0 };
        
        const svgRect = svgElement.getBoundingClientRect();
        const viewBox = svgElement.viewBox.baseVal;
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;
        
        return {
            x: svgRect.left + (planet.position.x * scaleX),
            y: svgRect.top + (planet.position.y * scaleY),
        };
    }

    function showFloatingText(event: ReinforcementEvent | ConquestEvent, text: string, color: string): void {
        const planet = gameState.planets.find(p => p.id === event.planetId);
        if (!planet) return;
        
        const coords = getScreenCoords(planet);
        floatingTexts = [...floatingTexts, {
            id: event.id,
            x: coords.x,
            y: coords.y,
            text,
            color,
        }];
        
        // Remove after animation completes
        setTimeout(() => {
            floatingTexts = floatingTexts.filter(ft => ft.id !== event.id);
        }, 3000);
    }
    
    function showEliminationText(event: PlayerEliminationEvent, planet: PlanetType): void {
        const coords = getScreenCoords(planet);
        floatingTexts = [...floatingTexts, {
            id: event.id,
            x: coords.x,
            y: coords.y - 30, // Offset slightly above planet
            text: `${event.playerName} has been eliminated!`,
            color: event.playerColor,
        }];
        
        // Remove after animation completes
        setTimeout(() => {
            floatingTexts = floatingTexts.filter(ft => ft.id !== event.id);
        }, 3000);
    }

    $: {
        // Process reinforcement events
        const reinforcementEvents = gameState.recentReinforcementEvents ?? [];
        for (const event of reinforcementEvents) {
            if (!processedEventIds.has(event.id)) {
                processedEventIds.add(event.id);
                showFloatingText(
                    event,
                    `+${event.ships} Reinforcements`,
                    event.playerColor
                );
            }
        }

        // Process conquest events
        const conquestEvents = gameState.recentConquestEvents ?? [];
        for (const event of conquestEvents) {
            if (!processedEventIds.has(event.id)) {
                processedEventIds.add(event.id);
                showFloatingText(
                    event,
                    'Conquered!',
                    event.attackerColor
                );
                
                // Check if there's an elimination event for this planet (no battle case)
                // Show elimination text after a short delay
                const eliminationEvent = gameState.recentPlayerEliminationEvents?.find(
                    e => e.planetId === event.planetId
                );
                if (eliminationEvent && !processedEventIds.has(eliminationEvent.id)) {
                    processedEventIds.add(eliminationEvent.id);
                    const planet = gameState.planets.find(p => p.id === event.planetId);
                    if (planet) {
                        // Show elimination text after "Conquered!" text (with delay)
                        setTimeout(() => {
                            showEliminationText(eliminationEvent, planet);
                        }, 1500);
                    }
                }
            }
        }
        
        // Process elimination events (for battles - will be shown after battle dialog closes)
        const eliminationEvents = gameState.recentPlayerEliminationEvents ?? [];
        for (const event of eliminationEvents) {
            if (!processedEventIds.has(event.id)) {
                // Check if there's an active battle animation or a battle replay at this planet
                const hasActiveBattle = [...$battleAnimations.values()].some(
                    a => a.replay.planetId === event.planetId
                );
                const hasBattleReplay = gameState.recentBattleReplays?.some(
                    r => r.planetId === event.planetId
                );
                
                if (hasActiveBattle || hasBattleReplay) {
                    // Battle exists or is active - queue elimination text for after battle
                    pendingEliminationTexts.set(event.planetId, event);
                    processedEventIds.add(event.id);
                } else {
                    // No battle - check if there's a conquest event (handled above)
                    // If not, show immediately (shouldn't happen normally, but handle it)
                    const hasConquestEvent = gameState.recentConquestEvents?.some(
                        e => e.planetId === event.planetId
                    );
                    if (!hasConquestEvent) {
                        processedEventIds.add(event.id);
                        const planet = gameState.planets.find(p => p.id === event.planetId);
                        if (planet) {
                            showEliminationText(event, planet);
                        }
                    }
                }
            }
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

<!-- Floating Text Messages (outside SVG for fixed positioning) -->
{#each floatingTexts as floatingText (floatingText.id)}
    <FloatingTextMessage
        x={floatingText.x}
        y={floatingText.y}
        text={floatingText.text}
        color={floatingText.color}
    />
{/each}

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
