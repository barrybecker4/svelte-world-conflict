<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import type { GalacticGameStateData, Planet } from '$lib/game/entities/gameTypes';
    import GalaxyMap from './galaxy/GalaxyMap.svelte';
    import GameInfoPanel from './GameInfoPanel.svelte';
    import SendArmadaModal from './modals/SendArmadaModal.svelte';
    import BuildShipsModal from './modals/BuildShipsModal.svelte';
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
    import { logger } from 'multiplayer-framework/shared';
    import { audioSystem, SOUNDS } from '$lib/client/audio';

    export let gameId: string;
    export let initialState: GalacticGameStateData;

    let showSendArmadaModal = false;
    let showBuildShipsModal = false;
    let showResignConfirmModal = false;
    let sourcePlanet: Planet | null = null;
    let destinationPlanet: Planet | null = null;
    let wsClient = getWebSocketClient();

    let connectionError: string | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let hasResigned = false;
    let gameEndSoundPlayed = false;

    // Track game completion and play appropriate sound
    $: if ($gameState?.status === 'COMPLETED' && !gameEndSoundPlayed) {
        gameEndSoundPlayed = true;
        const myPlayerId = $currentPlayerId;
        const winnerId = $gameState.endResult?.slotIndex;
        
        if (winnerId !== undefined && winnerId === myPlayerId) {
            audioSystem.playSound(SOUNDS.GAME_WON);
        } else if (winnerId !== undefined) {
            audioSystem.playSound(SOUNDS.GAME_LOST);
        }
    }

    // Poll server to process events and get updates (armada arrivals, battles)
    async function pollGameState() {
        try {
            const response = await GameApiClient.getGame(gameId);
            if (response.gameState) {
                console.log('[GalacticConflictGame] Poll received state with replays:', 
                    response.gameState.recentBattleReplays?.length ?? 0);
                updateGameState(response.gameState);
            }
        } catch (error) {
            logger.warn('Poll failed:', error);
        }
    }

    onMount(async () => {
        // Initialize state
        updateGameState(initialState);

        // Get current player from local storage
        const creatorInfo = loadGameCreator(gameId);
        if (creatorInfo) {
            currentPlayerId.set(creatorInfo.playerSlotIndex);
        }

        // Connect to WebSocket for real-time updates - REQUIRED
        try {
            await wsClient.connect(gameId);
        } catch (error) {
            const errorMsg = 'WebSocket connection failed. Make sure the WebSocket worker is running: npm run dev:websocket';
            logger.error(errorMsg, error);
            connectionError = errorMsg;
        }

        // Poll every 1 second to process server-side events (armada arrivals, battles)
        // This ensures the game loop runs even without player actions
        pollInterval = setInterval(pollGameState, 1000);
    });

    onDestroy(() => {
        wsClient.disconnect();
        if (pollInterval) {
            clearInterval(pollInterval);
        }
    });

    function handlePlanetClick(planet: Planet) {
        const currentPlayer = get(currentPlayerId);

        if (currentPlayer === null) return;

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

        if (currentPlayer === null) return;
        if (source.ownerId !== currentPlayer || source.ships <= 0) return;

        sourcePlanet = source;
        destinationPlanet = dest;
        showSendArmadaModal = true;
    }

    function handlePlanetDoubleClick(event: CustomEvent<{ planet: Planet }>) {
        const { planet } = event.detail;
        const currentPlayer = get(currentPlayerId);

        if (currentPlayer === null) return;
        if (planet.ownerId !== currentPlayer) return;

        sourcePlanet = planet;
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

            // Optimistic update: Add the armada to local state immediately
            if (response.success && response.armada) {
                gameState.update(state => {
                    if (!state) return state;

                    // Find and update source planet ship count
                    const updatedPlanets = state.planets.map(p => {
                        if (p.id === sourcePlanet!.id) {
                            return { ...p, ships: p.ships - shipCount };
                        }
                        return p;
                    });

                    return {
                        ...state,
                        planets: updatedPlanets,
                        armadas: [...state.armadas, response.armada],
                    };
                });
            }

            showSendArmadaModal = false;
            destinationPlanet = null;
            selectedPlanetId.set(null);
        } catch (error) {
            // Modal will show updated state - user can see what changed and close it
            logger.error('Failed to send armada:', error);
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
                                resources: response.newResourceCount ?? p.resources,
                            };
                        }
                        return p;
                    });

                    return {
                        ...state,
                        planets: updatedPlanets,
                    };
                });
            }

            showBuildShipsModal = false;
        } catch (error) {
            logger.error('Failed to build ships:', error);
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
        <div class="connection-error">
            <h2>Connection Failed</h2>
            <p>{connectionError}</p>
            <div class="error-instructions">
                <p>To start the WebSocket worker, run in a separate terminal:</p>
                <code>npm run dev:websocket</code>
                <p>Then refresh this page.</p>
            </div>
            <button on:click={() => window.location.reload()}>Retry Connection</button>
        </div>
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
                    onPlanetClick={handlePlanetClick}
                    on:dragSend={handleDragSend}
                    on:doubleClick={handlePlanetDoubleClick}
                />
            </div>
        </div>
    {:else}
        <div class="loading">Loading game...</div>
    {/if}
</div>

{#if showSendArmadaModal && sourcePlanet && $gameState}
    <SendArmadaModal
        {sourcePlanet}
        planets={$gameState.planets}
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
        on:build={handleBuildShips}
        on:close={() => showBuildShipsModal = false}
    />
{/if}

{#if showResignConfirmModal}
    <div class="modal-overlay" on:click={handleCancelResign} on:keydown={(e) => e.key === 'Escape' && handleCancelResign()} role="button" tabindex="0">
        <div class="resign-modal" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" aria-labelledby="resign-modal-title">
            <h2 id="resign-modal-title">Resign from Game?</h2>
            <p>Are you sure you want to resign? Your planets will become neutral and your fleets will be disbanded.</p>
            <p class="spectate-note">You'll still be able to watch the rest of the game.</p>
            <div class="modal-buttons">
                <button class="cancel-btn" on:click={handleCancelResign}>
                    Cancel
                </button>
                <button class="confirm-resign-btn" on:click={handleConfirmResign}>
                    Resign
                </button>
            </div>
        </div>
    </div>
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

    .connection-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #e5e7eb;
        text-align: center;
        padding: 2rem;
    }

    .connection-error h2 {
        color: #ef4444;
        font-size: 1.75rem;
        margin-bottom: 1rem;
    }

    .connection-error p {
        color: #9ca3af;
        margin: 0.5rem 0;
    }

    .error-instructions {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 1.5rem;
        margin: 1.5rem 0;
    }

    .error-instructions code {
        display: block;
        background: #1f1f2e;
        padding: 0.75rem 1rem;
        border-radius: 4px;
        font-family: monospace;
        color: #a78bfa;
        margin: 0.75rem 0;
    }

    .connection-error button {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
    }

    .connection-error button:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
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

    /* Resign confirmation modal */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .resign-modal {
        background: linear-gradient(145deg, #1a1a2e, #16162a);
        border: 1px solid #374151;
        border-radius: 16px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .resign-modal h2 {
        color: #f87171;
        font-size: 1.5rem;
        margin: 0 0 1rem 0;
        text-align: center;
    }

    .resign-modal p {
        color: #e5e7eb;
        margin: 0 0 0.75rem 0;
        text-align: center;
        line-height: 1.5;
    }

    .resign-modal .spectate-note {
        color: #9ca3af;
        font-size: 0.9rem;
        font-style: italic;
    }

    .modal-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 1.5rem;
        justify-content: center;
    }

    .cancel-btn {
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: 1px solid #4b5563;
        border-radius: 8px;
        color: #9ca3af;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #6b7280;
        color: #e5e7eb;
    }

    .confirm-resign-btn {
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #dc2626, #b91c1c);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .confirm-resign-btn:hover {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        transform: scale(1.05);
    }
</style>

