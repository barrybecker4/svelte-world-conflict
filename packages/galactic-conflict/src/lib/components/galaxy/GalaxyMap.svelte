<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { GalacticGameStateData, Planet as PlanetType } from '$lib/game/entities/gameTypes';
    import { GALACTIC_CONSTANTS } from '$lib/game/constants/gameConstants';
    import { isGameCompleted, canPlayerInteract } from '$lib/client/utils/gameStateChecks';
    import { clearAllBattleAnimations } from '$lib/client/stores/battleAnimationStore';
    import { useAnimationTime } from '$lib/client/hooks/useAnimationTime';
    import { useDragAndDrop } from '$lib/client/interactions/useDragAndDrop';
    import { useBattleCoordinator } from '$lib/client/hooks/useBattleCoordinator';
    import Planet from './Planet.svelte';
    import Armada from './Armada.svelte';
    import BattleAnimationOverlay from './battle-animation/BattleAnimationOverlay.svelte';
    import FloatingTextManager from './FloatingTextManager.svelte';
    import GalaxySVGDefinitions from './GalaxySVGDefinitions.svelte';
    import DragVisualization from './DragVisualization.svelte';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let selectedPlanetId: number | null = null;
    export let hasResigned: boolean = false;
    export let onPlanetClick: (planet: PlanetType) => void = () => {};

    const dispatch = createEventDispatcher<{
        dragSend: { sourcePlanet: PlanetType; destinationPlanet: PlanetType };
        doubleClick: { planet: PlanetType };
    }>();

    let svgElement: SVGSVGElement;
    let floatingTextManager: FloatingTextManager;

    // Use animation time hook
    const currentTime = useAnimationTime(() => !isGameCompleted(gameState));

    // Use drag and drop hook
    const { dragState, handlers } = useDragAndDrop({
        svgElement: () => svgElement,
        planets: () => gameState.planets,
        canDrag: (planetId: number) => {
            if (!canPlayerInteract(gameState, currentPlayerId, hasResigned)) {
                return false;
            }
            const planet = gameState.planets.find(p => p.id === planetId);
            return planet?.ownerId === currentPlayerId && (planet?.ships ?? 0) > 0;
        },
        onDragComplete: (sourcePlanet: PlanetType, destinationPlanet: PlanetType) => {
            dispatch('dragSend', { sourcePlanet, destinationPlanet });
        },
        onDoubleClick: (planet: PlanetType) => {
            // Dispatch double-click event to open build dialog
            if (planet.ownerId === currentPlayerId) {
                dispatch('doubleClick', { planet });
            }
        }
    });

    // Use battle coordinator hook (doesn't need a reactive gameState parameter)
    const { 
        battleAnimations, 
        hasAnimationAtPlanet, 
        getDisplayPlanet, 
        processReplays,
        pendingEliminationTexts 
    } = useBattleCoordinator({ subscribe: (fn) => { fn(gameState); return () => {}; } });

    onMount(() => {
        // Process any existing battle replays when component mounts
        if (gameState.recentBattleReplays?.length > 0) {
            console.log(`[GalaxyMap] Mount: ${gameState.recentBattleReplays.length} battle replays to play`);
            processReplays(gameState);
        }
    });

    onDestroy(() => {
        // Clean up battle animations
        clearAllBattleAnimations();
    });

    // Process battle replays reactively
    $: processReplays(gameState);

    function handlePlanetClick(planet: PlanetType) {
        onPlanetClick(planet);
    }

    function handlePlanetPointerDown(planet: PlanetType, event: PointerEvent) {
        handlers.handlePointerDown(planet, event);
    }

    function handlePlanetDoubleClick(planet: PlanetType) {
        // Check if player can interact
        if (!canPlayerInteract(gameState, currentPlayerId, hasResigned)) {
            return;
        }
        
        handlers.handleDoubleClick(planet);
        
        if (planet.ownerId === currentPlayerId) {
            dispatch('doubleClick', { planet });
        }
    }

    function getPlanetById(id: number): PlanetType | undefined {
        return gameState.planets.find(p => p.id === id);
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
        <!-- SVG Definitions and Background -->
        <GalaxySVGDefinitions />

        <!-- Armadas (draw first so they appear behind planets) -->
        {#each gameState.armadas as armada (armada.id)}
            {@const sourcePlanet = getPlanetById(armada.sourcePlanetId)}
            {@const destPlanet = getPlanetById(armada.destinationPlanetId)}
            {#if sourcePlanet && destPlanet}
                <Armada
                    {armada}
                    {sourcePlanet}
                    destinationPlanet={destPlanet}
                    currentTime={$currentTime}
                />
            {/if}
        {/each}

        <!-- Planets -->
        {#each gameState.planets as planet (planet.id)}
            {#key $battleAnimations}
                {@const displayPlanet = getDisplayPlanet(planet, $battleAnimations)}
                {@const isOwned = displayPlanet.ownerId === currentPlayerId}
                {@const canMovePlanet = isOwned && displayPlanet.ships > 0}
                <Planet
                    planet={displayPlanet}
                    isSelected={selectedPlanetId === planet.id}
                    {isOwned}
                    canMove={canMovePlanet}
                    hasBattle={hasAnimationAtPlanet(planet.id, $battleAnimations)}
                    on:click={() => handlePlanetClick(planet)}
                    on:pointerdown={(e) => handlePlanetPointerDown(planet, e)}
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

        <!-- Drag Visualization -->
        <DragVisualization
            isDragging={$dragState.isDragging}
            sourcePlanet={$dragState.sourcePlanet}
            currentX={$dragState.currentX}
            currentY={$dragState.currentY}
        />
    </svg>
</div>

<!-- Floating Text Manager -->
<FloatingTextManager
    bind:this={floatingTextManager}
    {gameState}
    {svgElement}
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
        touch-action: none;
        -webkit-user-select: none;
    }
</style>
