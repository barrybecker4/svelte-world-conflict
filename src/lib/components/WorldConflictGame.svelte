<script lang="ts">
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import GameMap from '$lib/components/world-conflict/GameMap.svelte';
    import type { WorldConflictStateData } from '$lib/game/WorldConflictGameState.ts';
    import type { Player, Region } from '$lib/game/WorldConflictGameState.ts';

    export let gameId: string;
    export let playerId: string;
    export let playerIndex: number;

    // Game state
    let gameState = writable<WorldConflictStateData | null>(null);
    let regions: Region[] = [];
    let selectedRegion: Region | null = null;
    let moveMode: 'SELECT_SOURCE' | 'SELECT_DESTINATION' | 'BUILD' | 'IDLE' = 'IDLE';
    let sourceRegion: number | null = null;
    let loading = false;
    let error: string | null = null;

    // UI state
    let showUpgradePanel = false;
    let selectedUpgrade: number | null = null;

    onMount(() => {
        loadGameState();
        setupWebSocket();
    });

    async function loadGameState() {
        loading = true;
        try {
            const response = await fetch(`/api/game/${gameId}`);
            if (!response.ok) throw new Error('Failed to load game');

            const data = await response.json();
            console.log('🎮 Loaded game data:', data);
            console.log('🏛️ Game state owners:', data.worldConflictState?.owners);
            console.log('⚔️ Soldiers by region:', data.worldConflictState?.soldiersByRegion);
            console.log('👥 Players:', data.worldConflictState?.players);
            console.log('🏰 Regions count:', data.worldConflictState?.regions?.length);

            gameState.set(data.worldConflictState);
            regions = data.worldConflictState.regions;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Unknown error';
        } finally {
            loading = false;
        }
    }

    function setupWebSocket() {
        // WebSocket setup for real-time updates
        const wsUrl = `ws://localhost:8787/websocket?gameId=${gameId}`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'gameUpdate') {
                gameState.set(message.gameState);
            }
        };
    }

    function handleRegionClick(region: Region) {
        const state = $gameState;
        if (!state) return;

        const currentPlayer = state.players[state.playerIndex];
        const isMyTurn = currentPlayer.id === playerId;

        if (!isMyTurn) {
            error = "It's not your turn";
            return;
        }

        if (moveMode === 'SELECT_SOURCE') {
            if (state.owners[region.index] === playerIndex && state.soldiersByRegion[region.index]?.length > 0) {
                sourceRegion = region.index;
                selectedRegion = region;
                moveMode = 'SELECT_DESTINATION';
            }
        } else if (moveMode === 'SELECT_DESTINATION') {
            if (region.index === sourceRegion) {
                // Clicking source again - cancel move
                moveMode = 'SELECT_SOURCE';
                sourceRegion = null;
                selectedRegion = null;
            } else {
                // Attempt move/attack
                makeMove(sourceRegion!, region.index);
                moveMode = 'IDLE';
                sourceRegion = null;
                selectedRegion = null;
            }
        } else if (moveMode === 'BUILD') {
            if (state.owners[region.index] === playerIndex && region.hasTemple) {
                selectedRegion = region;
                showUpgradePanel = true;
            }
        } else {
            selectedRegion = region;
        }
    }

    async function makeMove(fromRegion: number, toRegion: number) {
        try {
            const response = await fetch(`/api/game/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    fromRegion,
                    toRegion,
                    moveType: 'ATTACK'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Move failed');
            }

            await loadGameState();
        } catch (err) {
            error = err instanceof Error ? err.message : 'Move failed';
        }
    }

    async function endTurn() {
        try {
            const response = await fetch(`/api/game/${gameId}/end-turn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to end turn');
            }

            await loadGameState();
            moveMode = 'IDLE';
            selectedRegion = null;
            sourceRegion = null;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to end turn';
        }
    }

    function isMyRegion(regionIndex: number): boolean {
        const state = $gameState;
        return state?.owners[regionIndex] === playerIndex;
    }

    function getCurrentPlayerName(): string {
        const state = $gameState;
        if (!state) return '';
        return state.players[state.playerIndex]?.name || '';
    }

    function getMovesRemaining(): number {
        const state = $gameState;
        return state?.movesRemaining || 0;
    }

    function getTurnNumber(): number {
        const state = $gameState;
        return state?.turn || 1;
    }

    function isMyTurn(): boolean {
        const state = $gameState;
        if (!state) return false;
        const currentPlayer = state.players[state.playerIndex];
        return currentPlayer?.id === playerId;
    }

    function getRegionCount(playerIdx: number): number {
        const state = $gameState;
        if (!state) return 0;
        return Object.values(state.owners).filter(owner => owner === playerIdx).length;
    }

    function getFaithCount(playerIdx: number): number {
        const state = $gameState;
        // This would need to be implemented in your game state
        return 0; // Placeholder
    }
</script>

<div class="world-conflict-game">
    {#if loading}
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Loading game...</p>
        </div>
    {:else if error}
        <div class="error">
            <h3>Game Error</h3>
            <p>{error}</p>
            <button on:click={() => error = null} class="dismiss-error">Dismiss</button>
        </div>
    {:else}
        <!-- Game Info Panel -->
        <div class="game-info">
            <div class="game-status">
                <h2>Turn {getTurnNumber()}</h2>
                <div class="current-player">
                    Current Player: <span class="player-name">{getCurrentPlayerName()}</span>
                </div>
                <div class="moves-remaining">
                    Moves Remaining: <span class="moves-count">{getMovesRemaining()}</span>
                </div>
                {#if !isMyTurn()}
                    <div class="waiting-indicator">Waiting for other players...</div>
                {:else}
                    <div class="turn-indicator">It's your turn!</div>
                {/if}
            </div>

            <!-- Player List -->
            <div class="player-info">
                <h3>Players</h3>
                {#each $gameState?.players || [] as player}
                    <div class="player-card" class:active={player.index === $gameState?.playerIndex}>
                        <div class="player-color" style="background-color: {player.color}"></div>
                        <div class="player-details">
                            <div class="player-name">{player.name}</div>
                            <div class="player-stats">
                                <span>Regions: {getRegionCount(player.index)}</span>
                                <span>Faith: {getFaithCount(player.index)}</span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Action Buttons (only show on player's turn) -->
            {#if isMyTurn()}
                <div class="action-buttons">
                    <button
                        class="action-btn"
                        class:active={moveMode === 'SELECT_SOURCE'}
                        on:click={() => {
                            moveMode = moveMode === 'SELECT_SOURCE' ? 'IDLE' : 'SELECT_SOURCE';
                            selectedRegion = null;
                            sourceRegion = null;
                        }}
                    >
                        {moveMode === 'SELECT_SOURCE' ? 'Cancel Move' : 'Move Armies'}
                    </button>

                    <button
                        class="action-btn"
                        class:active={moveMode === 'BUILD'}
                        on:click={() => {
                            moveMode = moveMode === 'BUILD' ? 'IDLE' : 'BUILD';
                            selectedRegion = null;
                            showUpgradePanel = false;
                        }}
                    >
                        {moveMode === 'BUILD' ? 'Cancel Build' : 'Build/Upgrade'}
                    </button>

                    <button
                        class="action-btn end-turn"
                        on:click={endTurn}
                        disabled={moveMode !== 'IDLE'}
                    >
                        End Turn
                    </button>
                </div>
            {/if}

            <!-- Game Mode Indicator -->
            {#if moveMode !== 'IDLE'}
                <div class="mode-indicator">
                    {#if moveMode === 'SELECT_SOURCE'}
                        Select a region with your armies to move from
                    {:else if moveMode === 'SELECT_DESTINATION'}
                        Select destination to move/attack
                    {:else if moveMode === 'BUILD'}
                        Select a temple to upgrade
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Game Map -->
        <div class="game-map-container">
            <GameMap
                {regions}
                gameState={$gameState}
                {selectedRegion}
                {moveMode}
                onRegionClick={handleRegionClick}
            />
        </div>

        <!-- Upgrade Panel -->
        {#if showUpgradePanel && selectedRegion !== null}
            <div class="upgrade-panel">
                <h3>Upgrade Temple in {selectedRegion.name}</h3>
                <div class="upgrade-options">
                    <button on:click={() => selectedUpgrade = 0}>🔥 Fire Upgrade (Cost: 2 Faith)</button>
                    <button on:click={() => selectedUpgrade = 1}>💧 Water Upgrade (Cost: 2 Faith)</button>
                    <button on:click={() => selectedUpgrade = 2}>🌍 Earth Upgrade (Cost: 2 Faith)</button>
                    <button on:click={() => selectedUpgrade = 3}>💨 Air Upgrade (Cost: 2 Faith)</button>
                    <hr />
                    <button on:click={() => selectedUpgrade = 4}>👥 Recruit Soldier (Cost: 1 Faith)</button>
                </div>
                <div class="panel-actions">
                    <button class="confirm-btn" disabled={selectedUpgrade === null}>
                        Confirm Upgrade
                    </button>
                    <button class="close-panel" on:click={() => {
                        showUpgradePanel = false;
                        selectedUpgrade = null;
                        selectedRegion = null;
                        moveMode = 'IDLE';
                    }}>
                        Cancel
                    </button>
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .world-conflict-game {
        display: flex;
        height: 100vh;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .loading, .error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        text-align: center;
        padding: 2rem;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #475569;
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .error {
        color: #ef4444;
    }

    .dismiss-error {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
    }

    .game-info {
        width: 320px;
        padding: 1.5rem;
        background: rgba(15, 23, 42, 0.9);
        border-right: 1px solid #475569;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .game-status {
        text-align: center;
    }

    .game-status h2 {
        margin: 0 0 1rem 0;
        color: #f1f5f9;
        font-size: 1.5rem;
    }

    .current-player, .moves-remaining {
        margin: 0.5rem 0;
        color: #cbd5e1;
    }

    .player-name, .moves-count {
        font-weight: bold;
        color: #f1f5f9;
    }

    .waiting-indicator {
        background: #64748b;
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-top: 1rem;
    }

    .turn-indicator {
        background: #16a34a;
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-top: 1rem;
        font-weight: bold;
    }

    .player-info h3 {
        margin: 0 0 1rem 0;
        color: #f1f5f9;
    }

    .player-card {
        display: flex;
        align-items: center;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border-radius: 0.5rem;
        background: rgba(71, 85, 105, 0.3);
        border: 1px solid transparent;
        transition: all 0.2s ease;
    }

    .player-card.active {
        border-color: #38bdf8;
        background: rgba(56, 189, 248, 0.2);
    }

    .player-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        margin-right: 0.75rem;
        border: 2px solid #fff;
        flex-shrink: 0;
    }

    .player-details {
        flex: 1;
    }

    .player-stats {
        font-size: 0.75rem;
        color: #cbd5e1;
        display: flex;
        gap: 1rem;
        margin-top: 0.25rem;
    }

    .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .action-btn {
        padding: 0.75rem;
        border: none;
        border-radius: 0.5rem;
        background: #475569;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: 500;
        font-size: 0.9rem;
    }

    .action-btn:hover:not(:disabled) {
        background: #64748b;
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .action-btn.active {
        background: #3b82f6;
    }

    .action-btn.end-turn {
        background: #dc2626;
    }

    .action-btn.end-turn:hover:not(:disabled) {
        background: #ef4444;
    }

    .mode-indicator {
        background: #1e40af;
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        text-align: center;
    }

    .game-map-container {
        flex: 1;
        padding: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .upgrade-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e293b;
        border: 2px solid #475569;
        border-radius: 0.75rem;
        padding: 2rem;
        min-width: 350px;
        max-width: 90vw;
        z-index: 1000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }

    .upgrade-panel h3 {
        margin: 0 0 1.5rem 0;
        color: #f1f5f9;
        text-align: center;
    }

    .upgrade-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .upgrade-options button {
        padding: 1rem;
        border: 2px solid #475569;
        border-radius: 0.5rem;
        background: #334155;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }

    .upgrade-options button:hover {
        background: #475569;
        border-color: #64748b;
    }

    .upgrade-options hr {
        border: none;
        border-top: 1px solid #475569;
        margin: 0.5rem 0;
    }

    .panel-actions {
        display: flex;
        gap: 1rem;
    }

    .confirm-btn {
        flex: 1;
        padding: 0.75rem;
        border: none;
        border-radius: 0.5rem;
        background: #16a34a;
        color: white;
        cursor: pointer;
        font-weight: bold;
    }

    .confirm-btn:disabled {
        background: #64748b;
        cursor: not-allowed;
    }

    .close-panel {
        flex: 1;
        padding: 0.75rem;
        border: none;
        border-radius: 0.5rem;
        background: #6b7280;
        color: white;
        cursor: pointer;
    }

    .close-panel:hover {
        background: #9ca3af;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
        .world-conflict-game {
            flex-direction: column;
        }

        .game-info {
            width: 100%;
            max-height: 40vh;
            border-right: none;
            border-bottom: 1px solid #475569;
        }

        .game-map-container {
            padding: 1rem;
        }

        .upgrade-panel {
            min-width: 90vw;
            padding: 1.5rem;
        }
    }
</style>
