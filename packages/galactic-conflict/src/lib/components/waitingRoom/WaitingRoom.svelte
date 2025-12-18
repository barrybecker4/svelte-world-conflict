<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { PendingGameData } from '$lib/game/entities/gameTypes';
    import { GameApiClient } from '$lib/client/gameController/GameApiClient';
    import { getWebSocketClient } from '$lib/client/websocket/GameWebSocketClient';
    import { loadGameCreator } from '$lib/client/stores/clientStorage';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';
    import { logger } from 'multiplayer-framework/shared';

    const dispatch = createEventDispatcher();

    export let gameId: string;
    export let initialGame: PendingGameData | null = null;

    let game: PendingGameData | null = initialGame;
    let loading = false;
    let error: string | null = null;
    let isConnected = false;
    let currentPlayerId: number | null = null;
    let isCreator = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    let wsClient = getWebSocketClient();

    onMount(async () => {
        const creatorInfo = loadGameCreator(gameId);
        if (creatorInfo) {
            currentPlayerId = creatorInfo.playerSlotIndex;
            isCreator = true;
        }

        // Connect to WebSocket
        try {
            await wsClient.connect(gameId);
            isConnected = true;

            // Listen for game started
            wsClient.on('gameStarted', () => {
                dispatch('gameStarted', { gameId });
            });

            // Listen for player joined
            wsClient.on('playerJoined', async () => {
                await refreshGame();
            });
        } catch (err) {
            logger.error('Failed to connect WebSocket:', err);
        }

        // Poll for updates (2 seconds for quick detection of game start)
        pollInterval = setInterval(refreshGame, 2000);
    });

    onDestroy(() => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        wsClient.disconnect();
    });

    async function refreshGame() {
        try {
            const data = await GameApiClient.getGame(gameId);
            if (data.status === 'ACTIVE') {
                dispatch('gameStarted', { gameId });
            } else {
                // Only update if player slots actually changed to prevent flickering
                const currentSlots = game?.pendingConfiguration?.playerSlots || [];
                const newSlots = data?.pendingConfiguration?.playerSlots || [];
                
                // Compare by checking if slot types/names changed
                const slotsChanged = currentSlots.length !== newSlots.length ||
                    currentSlots.some((slot, i) => {
                        const newSlot = newSlots[i];
                        return !newSlot || 
                            slot.type !== newSlot.type || 
                            slot.name !== newSlot.name ||
                            slot.slotIndex !== newSlot.slotIndex;
                    });
                
                if (game === null || slotsChanged) {
                    game = data;
                }
            }
        } catch (err) {
            logger.warn('Failed to refresh game:', err);
        }
    }

    async function handleStartGame() {
        loading = true;
        error = null;
        try {
            await GameApiClient.startGame(gameId);
            dispatch('gameStarted', { gameId });
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to start game';
        } finally {
            loading = false;
        }
    }

    function handleLeaveGame() {
        dispatch('gameLeft');
    }

    $: playerSlots = game?.pendingConfiguration?.playerSlots || [];
    $: openSlots = playerSlots.filter(s => s.type === 'Open').length;
    $: filledSlots = playerSlots.filter(s => s.type === 'Set' || s.type === 'AI').length;
</script>

<div class="waiting-room-overlay">
    <div class="waiting-room">
        <header>
            <h1>🌌 Waiting Room</h1>
            <div class="game-info">
                <span class="game-id">Game: {gameId}</span>
                <span class="status" class:connected={isConnected}>
                    {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
            </div>
        </header>

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <div class="content">
            <section class="players-section">
                <h2>Players ({filledSlots}/{playerSlots.length})</h2>
                <div class="player-grid">
                    {#each playerSlots as slot}
                        <div 
                            class="player-slot"
                            class:filled={slot.type === 'Set' || slot.type === 'AI'}
                            class:open={slot.type === 'Open'}
                            class:current={slot.slotIndex === currentPlayerId}
                        >
                            <div 
                                class="slot-color"
                                style="background-color: {slot.type !== 'Open' ? getPlayerColor(slot.slotIndex) : '#374151'}"
                            ></div>
                            <div class="slot-info">
                                {#if slot.type === 'Set'}
                                    <span class="slot-name">{slot.name || `Player ${slot.slotIndex + 1}`}</span>
                                    <span class="slot-type">Human</span>
                                {:else if slot.type === 'AI'}
                                    <span class="slot-name">{slot.name || `AI ${slot.slotIndex + 1}`}</span>
                                    <span class="slot-type">AI</span>
                                {:else}
                                    <span class="slot-name">Waiting...</span>
                                    <span class="slot-type">Open Slot</span>
                                {/if}
                            </div>
                            {#if slot.slotIndex === currentPlayerId}
                                <span class="you-badge">YOU</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>

            <section class="settings-section">
                <h2>Game Settings</h2>
                <div class="settings-grid">
                    <div class="setting">
                        <span class="setting-label">Planets</span>
                        <span class="setting-value">{game?.pendingConfiguration?.settings?.planetCount || 30}</span>
                    </div>
                    <div class="setting">
                        <span class="setting-label">Duration</span>
                        <span class="setting-value">{game?.pendingConfiguration?.settings?.gameDuration || 15} min</span>
                    </div>
                    <div class="setting">
                        <span class="setting-label">Armada Speed</span>
                        <span class="setting-value">{game?.pendingConfiguration?.settings?.armadaSpeed || 100} u/min</span>
                    </div>
                </div>
            </section>

            <div class="status-message">
                {#if openSlots > 0}
                    <p>⏳ Waiting for {openSlots} more player{openSlots !== 1 ? 's' : ''}...</p>
                    <p class="share-hint">Share game ID: <strong>{gameId}</strong></p>
                {:else}
                    <p class="ready">🚀 All players ready!</p>
                {/if}
            </div>
        </div>

        <footer>
            {#if isCreator && openSlots > 0}
                <button 
                    class="start-btn"
                    on:click={handleStartGame}
                    disabled={loading}
                >
                    {loading ? 'Starting...' : 'Start Anyway'}
                </button>
            {/if}
            <button class="leave-btn" on:click={handleLeaveGame}>
                Leave Game
            </button>
        </footer>
    </div>
</div>

<style>
    .waiting-room-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .waiting-room {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        width: 100%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        color: #e5e7eb;
    }

    header {
        padding: 1.5rem;
        border-bottom: 1px solid #374151;
        text-align: center;
    }

    h1 {
        margin: 0;
        font-size: 1.75rem;
        color: #a78bfa;
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 1rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .game-info {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: #9ca3af;
    }

    .status.connected {
        color: #22c55e;
    }

    .error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid #ef4444;
        padding: 0.75rem;
        margin: 1rem;
        border-radius: 8px;
        color: #fca5a5;
        text-align: center;
    }

    .content {
        padding: 1.5rem;
    }

    .players-section {
        margin-bottom: 1.5rem;
    }

    .player-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;
    }

    .player-slot {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        position: relative;
    }

    .player-slot.filled {
        border-color: #4c1d95;
    }

    .player-slot.current {
        border-color: #a855f7;
        background: rgba(168, 85, 247, 0.1);
    }

    .player-slot.open {
        border-style: dashed;
    }

    .slot-color {
        width: 32px;
        height: 32px;
        border-radius: 50%;
    }

    .slot-info {
        flex: 1;
    }

    .slot-name {
        display: block;
        font-weight: 500;
    }

    .slot-type {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .you-badge {
        position: absolute;
        top: -8px;
        right: 8px;
        background: #a855f7;
        color: white;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: bold;
    }

    .settings-section {
        margin-bottom: 1.5rem;
    }

    .settings-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
    }

    .setting {
        text-align: center;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }

    .setting-label {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
        margin-bottom: 0.25rem;
    }

    .setting-value {
        font-size: 1.1rem;
        font-weight: bold;
    }

    .status-message {
        text-align: center;
        padding: 1rem;
        background: rgba(168, 85, 247, 0.1);
        border-radius: 8px;
    }

    .status-message p {
        margin: 0.25rem 0;
    }

    .status-message .ready {
        color: #22c55e;
        font-weight: bold;
    }

    .share-hint {
        font-size: 0.9rem;
        color: #9ca3af;
    }

    .share-hint strong {
        color: #a78bfa;
        font-family: monospace;
    }

    footer {
        display: flex;
        justify-content: center;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 1px solid #374151;
    }

    .start-btn {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .start-btn:hover:not(:disabled) {
        background: linear-gradient(135deg, #16a34a, #15803d);
    }

    .start-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .leave-btn {
        padding: 0.75rem 2rem;
        background: #374151;
        border: none;
        border-radius: 8px;
        color: #e5e7eb;
        cursor: pointer;
    }

    .leave-btn:hover {
        background: #4b5563;
    }

    @media (max-width: 640px) {
        .player-grid {
            grid-template-columns: 1fr;
        }

        .settings-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

