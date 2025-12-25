<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { AdBanner } from 'shared-ui';
    import type { GalacticGameStateData, Planet } from '$lib/game/entities/gameTypes';
    import GalaxyMap from './galaxy/GalaxyMap.svelte';
    import GameInfoPanel from './GameInfoPanel.svelte';
    import SendArmadaModal from './modals/SendArmadaModal.svelte';
    import BuildShipsModal from './modals/BuildShipsModal.svelte';
    import ResignConfirmModal from './modals/ResignConfirmModal.svelte';
    import ConnectionError from './ConnectionError.svelte';
    import { getWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';
    import { GameApiClient } from '$lib/client/gameController/GameApiClient';
    import { loadGameCreator } from '$lib/client/stores/clientStorage';
    import {
        gameState,
        selectedPlanetId,
        currentPlayerId,
        isConnected,
        updateGameState,
        clearGameStores,
    } from '$lib/client/stores/gameStateStore';
    import { trackOptimisticArmada } from '$lib/client/stores/optimisticArmadaStore';
    import { logger } from 'multiplayer-framework/shared';
    import { audioSystem, SOUNDS } from '$lib/client/audio';
    import { battleAnimations } from '$lib/client/stores/battleAnimationStore';

    export let gameId: string;
    export let initialState: GalacticGameStateData;

    let showSendArmadaModal = false;
    let showBuildShipsModal = false;
    let showResignConfirmModal = false;
    let sourcePlanet: Planet | null = null;
    let destinationPlanet: Planet | null = null;
    let wsClient = getWebSocketClient();

    let connectionError: string | null = null;
    let hasResigned = false;
    let gameEndSoundPlayed = false;
    let devEventProcessingInterval: ReturnType<typeof setInterval> | null = null;
    const processedEventIds = new Set<string>();

    // Ad configuration
    $: adUnitId = import.meta.env.VITE_ADSENSE_AD_UNIT_ID || '';
    $: showAds = adUnitId && $gameState && $gameState.status !== 'COMPLETED';
    
    // Track when to show game end announcement (after battle animations complete)
    // Don't check hasUnprocessedReplays - just wait for animations to finish
    $: shouldShowGameEndAnnouncement = $gameState?.status === 'COMPLETED' && $battleAnimations.size === 0;

    // Track game completion and play appropriate sound (wait for battle animations to finish)
    $: if ($gameState?.status === 'COMPLETED' && !gameEndSoundPlayed && $battleAnimations.size === 0) {
        gameEndSoundPlayed = true;
        const myPlayerId = $currentPlayerId;
        const winnerId = typeof $gameState.endResult === 'object' && $gameState.endResult 
            ? $gameState.endResult.slotIndex 
            : undefined;
        
        if (winnerId !== undefined && winnerId === myPlayerId) {
            audioSystem.playSound(SOUNDS.GAME_WON);
        } else if (winnerId !== undefined) {
            audioSystem.playSound(SOUNDS.GAME_LOST);
        }
    }

    // Play sounds for reinforcement and conquest events
    $: if ($gameState && $currentPlayerId !== null) {
        const myPlayerId = $currentPlayerId;

        // Process reinforcement events
        const reinforcementEvents = $gameState.recentReinforcementEvents ?? [];
        for (const event of reinforcementEvents) {
            if (!processedEventIds.has(event.id) && event.playerId === myPlayerId) {
                processedEventIds.add(event.id);
                audioSystem.playSound(SOUNDS.REINFORCEMENT_ARRIVED);
            }
        }

        // Process conquest events
        const conquestEvents = $gameState.recentConquestEvents ?? [];
        for (const event of conquestEvents) {
            if (!processedEventIds.has(event.id) && event.attackerPlayerId === myPlayerId) {
                processedEventIds.add(event.id);
                audioSystem.playSound(SOUNDS.PLANET_CONQUERED);
            }
        }
    }

    /**
     * Start periodic event processing on the server.
     * Automatically stops when the game is completed.
     */
    function startEventProcessing() {
        logger.debug('Starting event processing interval');
        devEventProcessingInterval = setInterval(async () => {
            // Stop polling if game is completed
            const currentState = get(gameState);
            if (currentState?.status === 'COMPLETED') {
                if (devEventProcessingInterval) {
                    logger.debug('Game completed - stopping event processing interval');
                    clearInterval(devEventProcessingInterval);
                    devEventProcessingInterval = null;
                }
                return;
            }

            try {
                await GameApiClient.processEvents();
            } catch (error) {
                // Silently fail - this is just triggering server-side processing
                // Errors are logged server-side
                logger.debug('Event processing trigger failed (non-critical):', error);
            }
        }, 2000); // Every 2 seconds
    }

    onMount(async () => {
        // Initialize state
        updateGameState(initialState);

        // Get current player from local storage
        let creatorInfo = loadGameCreator(gameId);
        
        // If not in localStorage, try to identify player from game state
        // This handles cases where player joined but localStorage wasn't set
        if (!creatorInfo && initialState.players) {
            logger.warn('No player info in localStorage for game', gameId);
        }
        
        if (creatorInfo) {
            currentPlayerId.set(creatorInfo.playerSlotIndex);
        } else {
            logger.error('Could not determine current player ID for game', gameId);
        }

        // Connect to WebSocket for real-time updates
        // Fail fast if websocket connection fails - no polling fallback
        try {
            await wsClient.connect(gameId);
        } catch (error) {
            const errorMsg = 'WebSocket connection failed. Make sure the WebSocket worker is running: npm run dev:websocket';
            logger.error(errorMsg, error);
            connectionError = errorMsg;
            // Fail fast - don't continue without websocket connection
            return;
        }

        // Start periodic event processing
        startEventProcessing();
    });

    onDestroy(() => {
        wsClient.disconnect();
        if (devEventProcessingInterval) {
            clearInterval(devEventProcessingInterval);
        }
    });

    function handlePlanetClick(planet: Planet) {
        const currentPlayer = get(currentPlayerId);
        const currentState = get(gameState);

        if (currentPlayer === null) return;
        
        // Disable interactions if game is completed
        if (currentState?.status === 'COMPLETED') return;

        // Simply select the planet when clicked
        
        if (planet.ownerId === currentPlayer) {
            selectedPlanetId.set(planet.id);
        } else {
            // Deselect if clicking on non-owned planet
            selectedPlanetId.set(null);
        }
    }

    function handleDragSend(event: CustomEvent<{ sourcePlanet: Planet; destinationPlanet: Planet }>) {
        const { sourcePlanet: source, destinationPlanet: dest } = event.detail;
        const currentPlayer = get(currentPlayerId);
        const currentState = get(gameState);

        if (currentPlayer === null || !currentState || hasResigned) return;
        
        // Disable interactions if game is completed
        if (currentState.status === 'COMPLETED') return;
        
        // Check if player is eliminated (resigned or defeated)
        if (currentState.eliminatedPlayers?.includes(currentPlayer)) return;

        // Resolve planets from current gameState to ensure fresh references
        const freshSourcePlanet = currentState.planets.find(p => p.id === source.id);
        const freshDestPlanet = currentState.planets.find(p => p.id === dest.id);

        if (!freshSourcePlanet || !freshDestPlanet) return;
        if (freshSourcePlanet.ownerId !== currentPlayer || freshSourcePlanet.ships <= 0) return;

        sourcePlanet = freshSourcePlanet;
        destinationPlanet = freshDestPlanet;
        showSendArmadaModal = true;
    }

    function handlePlanetDoubleClick(event: CustomEvent<{ planet: Planet }>) {
        const { planet } = event.detail;
        const currentPlayer = get(currentPlayerId);
        const currentState = get(gameState);

        if (currentPlayer === null || !currentState || hasResigned) return;
        
        // Disable interactions if game is completed
        if (currentState.status === 'COMPLETED') return;
        
        // Check if player is eliminated (resigned or defeated)
        if (currentState.eliminatedPlayers?.includes(currentPlayer)) return;

        // Resolve planet from current gameState to ensure fresh reference
        const freshPlanet = currentState.planets.find(p => p.id === planet.id);
        if (!freshPlanet) return;
        if (freshPlanet.ownerId !== currentPlayer) return;

        sourcePlanet = freshPlanet;
        showBuildShipsModal = true;
    }

    async function handleSendArmada(event: CustomEvent) {
        const { shipCount, destinationPlanetId } = event.detail;
        const currentPlayer = get(currentPlayerId);
        
        if (!sourcePlanet || currentPlayer === null) return;

        try {
            const response = await GameApiClient.sendArmada(
                gameId,
                currentPlayer,
                sourcePlanet.id,
                destinationPlanetId,
                shipCount
            );

            // Track and add the armada optimistically
            // The optimistic armada store will protect this armada from being removed
            // by stale server broadcasts (due to Cloudflare KV's eventual consistency)
            if (response.success && response.armada) {
                // Track this armada to protect it from stale server updates
                trackOptimisticArmada(response.armada);
                
                gameState.update(state => {
                    if (!state) return state;

                    // Check if armada already exists to prevent duplicates
                    const armadaExists = state.armadas.some(a => a.id === response.armada.id);
                    if (armadaExists) {
                        // WebSocket already updated, don't add duplicate
                        return state;
                    }

                    return {
                        ...state,
                        armadas: [...state.armadas, response.armada],
                    };
                });
            }

            // Close the modal after send attempt (success or failure)
            showSendArmadaModal = false;
            destinationPlanet = null;
            selectedPlanetId.set(null);
        } catch (error) {
            // Close modal even on error - user can reopen if needed
            logger.error('Failed to send armada:', error);
            showSendArmadaModal = false;
            destinationPlanet = null;
            selectedPlanetId.set(null);
        }
    }

    async function handleBuildShips(event: CustomEvent) {
        const { shipCount } = event.detail;
        const currentPlayer = get(currentPlayerId);
        
        if (!sourcePlanet || currentPlayer === null) return;

        try {
            const response = await GameApiClient.buildShips(
                gameId,
                currentPlayer,
                sourcePlanet.id,
                shipCount
            );

            // Update local state with server response
            if (response.success && response.newShipCount !== undefined) {
                gameState.update(state => {
                    if (!state) return state;

                    const updatedPlanets = state.planets.map(p => {
                        if (p.id === sourcePlanet!.id) {
                            return {
                                ...p,
                                ships: response.newShipCount,
                            };
                        }
                        return p;
                    });

                    // Update player's global resources
                    const updatedResourcesByPlayer = {
                        ...state.resourcesByPlayer,
                        [currentPlayer]: response.newPlayerResources ?? state.resourcesByPlayer?.[currentPlayer] ?? 0,
                    };

                    return {
                        ...state,
                        planets: updatedPlanets,
                        resourcesByPlayer: updatedResourcesByPlayer,
                    };
                });
            }

            showBuildShipsModal = false;
            sourcePlanet = null;
        } catch (error) {
            logger.error('Failed to build ships:', error);
            showBuildShipsModal = false;
            sourcePlanet = null;
        }
    }

    function handleNewGame() {
        // Clean up current game state
        wsClient.disconnect();
        clearGameStores();
        // Navigate to home page
        goto('/');
    }

    function handleResignClick() {
        showResignConfirmModal = true;
    }

    async function handleConfirmResign() {
        const currentPlayer = get(currentPlayerId);
        if (currentPlayer === null) return;

        try {
            await GameApiClient.resign(gameId, currentPlayer);
            hasResigned = true;
            showResignConfirmModal = false;
            logger.debug('Successfully resigned from game');
        } catch (error) {
            logger.error('Failed to resign:', error);
        }
    }

    function handleCancelResign() {
        showResignConfirmModal = false;
    }

    function handleLeaveGame() {
        // Clean up current game state
        wsClient.disconnect();
        clearGameStores();
        // Navigate to home page
        goto('/');
    }
</script>

<div class="game-container">
    {#if connectionError}
        <ConnectionError errorMessage={connectionError} />
    {:else if $gameState}
        <div class="game-layout">
            <div class="side-panel">
                <GameInfoPanel
                    gameState={$gameState}
                    currentPlayerId={$currentPlayerId}
                    isConnected={$isConnected}
                    onNewGame={handleNewGame}
                    onResign={handleResignClick}
                    onLeave={handleLeaveGame}
                    {hasResigned}
                />
            </div>
            <div class="map-area">
                <GalaxyMap
                    gameState={$gameState}
                    currentPlayerId={$currentPlayerId}
                    selectedPlanetId={$selectedPlanetId}
                    {hasResigned}
                    onPlanetClick={handlePlanetClick}
                    on:dragSend={handleDragSend}
                    on:doubleClick={handlePlanetDoubleClick}
                />
            </div>

            {#if showAds}
                <aside class="ad-sidebar">
                    <AdBanner
                        adUnitId={adUnitId}
                        adFormat="rectangle"
                        className="desktop-ad"
                    />
                </aside>
                <div class="ad-banner-mobile">
                    <AdBanner
                        adUnitId={adUnitId}
                        adFormat="horizontal"
                        className="mobile-ad"
                    />
                </div>
            {/if}
        </div>
    {:else}
        <div class="loading">Loading game...</div>
    {/if}
</div>

{#if showSendArmadaModal && sourcePlanet && $gameState}
    <SendArmadaModal
        {sourcePlanet}
        planets={$gameState.planets}
        players={$gameState.players}
        currentPlayerId={$currentPlayerId}
        preselectedDestination={destinationPlanet}
        on:send={handleSendArmada}
        on:close={() => {
            showSendArmadaModal = false;
            destinationPlanet = null;
            selectedPlanetId.set(null);
        }}
    />
{/if}

{#if showBuildShipsModal && sourcePlanet && $gameState}
    <BuildShipsModal
        planet={sourcePlanet}
        planets={$gameState.planets}
        currentPlayerId={$currentPlayerId}
        playerResources={$currentPlayerId !== null ? ($gameState.resourcesByPlayer?.[$currentPlayerId] ?? 0) : 0}
        on:build={handleBuildShips}
        on:close={() => {
            showBuildShipsModal = false;
            sourcePlanet = null;
        }}
    />
{/if}

{#if showResignConfirmModal}
    <ResignConfirmModal
        on:confirm={handleConfirmResign}
        on:cancel={handleCancelResign}
    />
{/if}

<style>
    .game-container {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: #0a0a14;
    }

    .game-layout {
        display: flex;
        width: 100%;
        height: 100%;
    }

    .map-area {
        flex: 1;
        height: 100%;
        overflow: hidden;
    }

    .side-panel {
        width: 320px;
        height: 100%;
        background: rgba(15, 15, 26, 0.95);
        border-right: 1px solid #374151;
        overflow-y: auto;
    }

    .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #a78bfa;
        font-size: 1.5rem;
    }


    .ad-sidebar {
        position: fixed;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        z-index: 100;
        display: none;
    }

    .ad-banner-mobile {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        display: none;
        background: rgba(0, 0, 0, 0.8);
        padding: 0.5rem;
        text-align: center;
    }

    @media (min-width: 1024px) {
        .ad-sidebar {
            display: block;
        }
    }

    @media (max-width: 1023px) {
        .ad-banner-mobile {
            display: block;
        }
    }

    @media (max-width: 768px) {
        .game-layout {
            flex-direction: column;
        }

        .side-panel {
            width: 100%;
            height: auto;
            max-height: 40vh;
        }
    }

</style>

