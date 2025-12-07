<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { get } from 'svelte/store';
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
    } from '$lib/client/stores/gameStateStore';
    import { logger } from '$lib/game/utils/logger';

    export let gameId: string;
    export let initialState: GalacticGameStateData;

    let showSendArmadaModal = false;
    let showBuildShipsModal = false;
    let sourcePlanet: Planet | null = null;
    let wsClient = getWebSocketClient();

    let connectionError: string | null = null;

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
    });

    onDestroy(() => {
        wsClient.disconnect();
    });

    function handlePlanetClick(planet: Planet) {
        const currentPlayer = get(currentPlayerId);
        const selectedPlanet = get(selectedPlanetId);

        if (currentPlayer === null) return;

        // If clicking on own planet
        if (planet.ownerId === currentPlayer) {
            if (selectedPlanet === planet.id) {
                // Clicking same planet - show build ships modal
                sourcePlanet = planet;
                showBuildShipsModal = true;
            } else {
                // Select this planet as source
                selectedPlanetId.set(planet.id);
            }
        } else if (selectedPlanet !== null) {
            // Clicking on another planet with source selected - send armada
            const state = get(gameState);
            const source = state?.planets.find(p => p.id === selectedPlanet);
            if (source && source.ownerId === currentPlayer && source.ships > 0) {
                sourcePlanet = source;
                showSendArmadaModal = true;
            }
        }
    }

    async function handleSendArmada(event: CustomEvent) {
        const { shipCount, destinationPlanetId } = event.detail;
        const currentPlayer = get(currentPlayerId);
        
        if (!sourcePlanet || currentPlayer === null) return;

        try {
            await GameApiClient.sendArmada(
                gameId,
                currentPlayer,
                sourcePlanet.id,
                destinationPlanetId,
                shipCount
            );
            showSendArmadaModal = false;
            selectedPlanetId.set(null);
        } catch (error) {
            logger.error('Failed to send armada:', error);
        }
    }

    async function handleBuildShips(event: CustomEvent) {
        const { shipCount } = event.detail;
        const currentPlayer = get(currentPlayerId);
        
        if (!sourcePlanet || currentPlayer === null) return;

        try {
            await GameApiClient.buildShips(
                gameId,
                currentPlayer,
                sourcePlanet.id,
                shipCount
            );
            showBuildShipsModal = false;
        } catch (error) {
            logger.error('Failed to build ships:', error);
        }
    }

    $: targetPlanet = $gameState?.planets.find(p => {
        return $selectedPlanetId !== null && 
               p.id !== $selectedPlanetId &&
               showSendArmadaModal;
    });
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
            <div class="map-area">
                <GalaxyMap
                    gameState={$gameState}
                    currentPlayerId={$currentPlayerId}
                    selectedPlanetId={$selectedPlanetId}
                    onPlanetClick={handlePlanetClick}
                />
            </div>
            <div class="side-panel">
                <GameInfoPanel
                    gameState={$gameState}
                    currentPlayerId={$currentPlayerId}
                    isConnected={$isConnected}
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
        on:send={handleSendArmada}
        on:close={() => {
            showSendArmadaModal = false;
            selectedPlanetId.set(null);
        }}
    />
{/if}

{#if showBuildShipsModal && sourcePlanet}
    <BuildShipsModal
        planet={sourcePlanet}
        on:build={handleBuildShips}
        on:close={() => showBuildShipsModal = false}
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
        border-left: 1px solid #374151;
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
</style>

