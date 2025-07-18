<script lang="ts">
    import { onMount } from 'svelte';
    import { writable } from 'svelte/store';
    import type { WorldConflictGameStateData } from '$lib/game/WorldConflictGameState.ts';
    import type { Player, Region } from '$lib/game/types.ts';

    export let gameId: string;
    export let playerId: string;
    export let playerIndex: number;

    // Game state
    let gameState = writable<WorldConflictGameStateData | null>(null);
    let regions: Region[] = [];
    let selectedRegion: number | null = null;
    let hoveredRegion: number | null = null;
    let moveMode: 'SELECT_SOURCE' | 'SELECT_DESTINATION' | 'BUILD' | 'IDLE' = 'IDLE';
    let sourceRegion: number | null = null;
    let loading = false;
    let error: string | null = null;

    // UI state
    let showGameInfo = true;
    let showUpgradePanel = false;
    let selectedUpgrade: number | null = null;

    onMount(() => {
        loadGameState();
        // Set up WebSocket connection for real-time updates
        setupWebSocket();
    });

    async function loadGameState() {
        loading = true;
        try {
            const response = await fetch(`/api/game/${gameId}`);
            if (!response.ok) throw new Error('Failed to load game');

            const data = await response.json();
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

    function selectRegion(regionIndex: number) {
        const state = $gameState;
        if (!state) return;

        const currentPlayer = state.players[state.playerIndex];
        const isMyTurn = currentPlayer.id === playerId;

        if (!isMyTurn) {
            error = "It's not your turn";
            return;
        }

        if (moveMode === 'SELECT_SOURCE') {
            if (state.owners[regionIndex] === playerIndex && state.soldiersByRegion[regionIndex]?.length > 0) {
                sourceRegion = regionIndex;
                selectedRegion = regionIndex;
                moveMode = 'SELECT_DESTINATION';
            } else {
                error = "You must select a region you own with armies";
            }
        } else if (moveMode === 'SELECT_DESTINATION' && sourceRegion !== null) {
            if (regionIndex !== sourceRegion) {
                makeArmyMove(sourceRegion, regionIndex);
            }
        } else if (moveMode === 'BUILD') {
            if (state.owners[regionIndex] === playerIndex && state.temples[regionIndex]) {
                selectedRegion = regionIndex;
                showUpgradePanel = true;
            } else {
                error = "You must select a region you own with a temple";
            }
        } else {
            selectedRegion = regionIndex;
            moveMode = 'IDLE';
        }
    }

    async function makeArmyMove(source: number, destination: number) {
        const state = $gameState;
        if (!state) return;

        const soldierCount = state.soldiersByRegion[source]?.length || 0;
        if (soldierCount === 0) {
            error = "No armies to move";
            return;
        }

        try {
            const response = await fetch(`/api/game/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    moveType: 'ARMY_MOVE',
                    source,
                    destination,
                    count: soldierCount
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }

            const result = await response.json();
            gameState.set(result.gameState);

            // Reset move mode
            moveMode = 'IDLE';
            sourceRegion = null;
            selectedRegion = null;
            error = null;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Move failed';
        }
    }

    async function makeBuildAction(upgradeIndex: number) {
        if (selectedRegion === null) return;

        try {
            const response = await fetch(`/api/game/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    moveType: 'BUILD',
                    regionIndex: selectedRegion,
                    upgradeIndex
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }

            const result = await response.json();
            gameState.set(result.gameState);

            showUpgradePanel = false;
            selectedRegion = null;
            error = null;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Build failed';
        }
    }

    async function endTurn() {
        try {
            const response = await fetch(`/api/game/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    moveType: 'END_TURN'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error);
            }

            const result = await response.json();
            gameState.set(result.gameState);

            moveMode = 'IDLE';
            selectedRegion = null;
            error = null;
        } catch (err) {
            error = err instanceof Error ? err.message : 'End turn failed';
        }
    }

    function getRegionColor(regionIndex: number): string {
        const state = $gameState;
        if (!state) return '#666';

        const ownerIndex = state.owners[regionIndex];
        if (ownerIndex === undefined) return '#666';

        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
        return colors[ownerIndex] || '#666';
    }

    function getRegionArmyCount(regionIndex: number): number {
        const state = $gameState;
        if (!state) return 0;
        return state.soldiersByRegion[regionIndex]?.length || 0;
    }

    function isMyRegion(regionIndex: number): boolean {
        const state = $gameState;
        if (!state) return false;
        return state.owners[regionIndex] === playerIndex;
    }

    function getCurrentPlayer(): Player | null {
        const state = $gameState;
        if (!state) return null;
        return state.players[state.playerIndex];
    }

    function isMyTurn(): boolean {
        const currentPlayer = getCurrentPlayer();
        return currentPlayer?.id === playerId;
    }

    $: currentPlayer = getCurrentPlayer();
    $: myTurn = isMyTurn();
</script>

<div class="world-conflict-game">
    {#if loading}
        <div class="loading">Loading game...</div>
    {:else if error}
        <div class="error">Error: {error}</div>
    {:else if $gameState}
        <!-- Game Info Panel -->
        <div class="game-info" class:collapsed={!showGameInfo}>
            <div class="turn-info">
                <h3>Turn {$gameState.turnIndex}</h3>
                <p>Current Player: <span class="player-name">{currentPlayer?.name}</span></p>
                <p>Moves Remaining: {$gameState.movesRemaining}</p>
                {#if myTurn}
                    <div class="turn-indicator">Your Turn!</div>
                {:else}
                    <div class="waiting-indicator">Waiting...</div>
                {/if}
            </div>

            <div class="player-info">
                {#each $gameState.players as player, index}
                    <div class="player-card" class:active={index === $gameState.playerIndex}>
                        <div class="player-color" style="background-color: {getRegionColor(index)}"></div>
                        <div class="player-details">
                            <div class="player-name">{player.name}</div>
                            <div class="player-stats">
                                <span>Regions: {Object.values($gameState.owners).filter(o => o === index).length}</span>
                                <span>Faith: {$gameState.cash[index] || 0}</span>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            {#if myTurn}
                <div class="action-buttons">
                    <button
                        class="action-btn"
                        class:active={moveMode === 'SELECT_SOURCE'}
                        on:click={() => moveMode = moveMode === 'SELECT_SOURCE' ? 'IDLE' : 'SELECT_SOURCE'}
                    >
                        Move Armies
                    </button>
                    <button
                        class="action-btn"
                        class:active={moveMode === 'BUILD'}
                        on:click={() => moveMode = moveMode === 'BUILD' ? 'IDLE' : 'BUILD'}
                    >
                        Build/Upgrade
                    </button>
                    <button class="action-btn end-turn" on:click={endTurn}>
                        End Turn
                    </button>
                </div>
            {/if}
        </div>

        <!-- Game Map -->
        <div class="game-map">
            <svg viewBox="0 0 300 250" class="map-svg">
                {#each regions as region}
                    <g class="region-group">
                        <!-- Region connections -->
                        {#each region.neighbors as neighborIndex}
                            {@const neighbor = regions.find(r => r.index === neighborIndex)}
                            {#if neighbor}
                                <line
                                    x1={region.x}
                                    y1={region.y}
                                    x2={neighbor.x}
                                    y2={neighbor.y}
                                    stroke="#555"
                                    stroke-width="1"
                                    class="connection"
                                />
                            {/if}
                        {/each}
                    {/g}
                {/each}

                {#each regions as region}
                    <g class="region" on:click={() => selectRegion(region.index)}>
                        <!-- Region circle -->
                        <circle
                            cx={region.x}
                            cy={region.y}
                            r="20"
                            fill={getRegionColor(region.index)}
                            stroke={selectedRegion === region.index ? '#fff' : '#333'}
                            stroke-width={selectedRegion === region.index ? '3' : '2'}
                            class="region-circle"
                            class:selectable={moveMode !== 'IDLE'}
                            class:my-region={isMyRegion(region.index)}
                        />

                        <!-- Temple indicator -->
                        {#if region.hasTemple}
                            <rect
                                x={region.x - 5}
                                y={region.y - 25}
                                width="10"
                                height="8"
                                fill="#ffd700"
                                stroke="#333"
                                class="temple-indicator"
                            />
                        {/if}

                        <!-- Army count -->
                        <text
                            x={region.x}
                            y={region.y + 5}
                            text-anchor="middle"
                            fill="#fff"
                            font-size="12"
                            font-weight="bold"
                            class="army-count"
                        >
                            {getRegionArmyCount(region.index)}
                        </text>

                        <!-- Region name -->
                        <text
                            x={region.x}
                            y={region.y + 35}
                            text-anchor="middle"
                            fill="#fff"
                            font-size="10"
                            class="region-name"
                        >
                            {region.name}
                        </text>
                    </g>
                {/each}
            </svg>
        </div>

        <!-- Upgrade Panel -->
        {#if showUpgradePanel && selectedRegion !== null}
            <div class="upgrade-panel">
                <h3>Upgrade Temple</h3>
                <div class="upgrade-options">
                    <button on:click={() => makeBuildAction(2)}>Air Magic (25 faith)</button>
                    <button on:click={() => makeBuildAction(3)}>Defense Magic (20 faith)</button>
                    <button on:click={() => makeBuildAction(4)}>Income Magic (30 faith)</button>
                    <button on:click={() => makeBuildAction(5)}>Rebuild Temple (10 faith)</button>
                </div>
                <button class="close-panel" on:click={() => showUpgradePanel = false}>Close</button>
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
        font-family: system-ui, sans-serif;
    }

    .loading, .error {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-size: 1.2rem;
    }

    .error {
        color: #ef4444;
    }

    .game-info {
        width: 300px;
        background: rgba(15, 23, 42, 0.9);
        border-right: 1px solid #475569;
        padding: 1rem;
        overflow-y: auto;
        transition: width 0.3s ease;
    }

    .game-info.collapsed {
        width: 60px;
    }

    .turn-info {
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #475569;
    }

    .turn-info h3 {
        margin: 0 0 0.5rem 0;
        color: #f1f5f9;
    }

    .player-name {
        color: #38bdf8;
        font-weight: bold;
    }

    .turn-indicator {
        background: #10b981;
        color: white;
        padding: 0.5rem;
        border-radius: 0.25rem;
        text-align: center;
        font-weight: bold;
        margin-top: 0.5rem;
    }

    .waiting-indicator {
        background: #6b7280;
        color: white;
        padding: 0.5rem;
        border-radius: 0.25rem;
        text-align: center;
        margin-top: 0.5rem;
    }

    .player-info {
        margin-bottom: 1.5rem;
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
        background: rgba(56, 189, 248, 0.1);
    }

    .player-color {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 0.75rem;
        border: 2px solid #fff;
    }

    .player-details {
        flex: 1;
    }

    .player-stats {
        font-size: 0.875rem;
        color: #cbd5e1;
        display: flex;
        gap: 1rem;
    }

    .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
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
    }

    .action-btn:hover {
        background: #64748b;
    }

    .action-btn.active {
        background: #3b82f6;
    }

    .action-btn.end-turn {
        background: #dc2626;
    }

    .action-btn.end-turn:hover {
        background: #ef4444;
    }

    .game-map {
        flex: 1;
        padding: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .map-svg {
        width: 100%;
        height: 100%;
        max-width: 800px;
        max-height: 600px;
        background: rgba(15, 23, 42, 0.8);
        border-radius: 1rem;
        border: 1px solid #475569;
    }

    .connection {
        opacity: 0.6;
    }

    .region {
        cursor: pointer;
    }

    .region-circle {
        transition: all 0.2s ease;
    }

    .region-circle:hover {
        stroke-width: 3;
        stroke: #38bdf8;
    }

    .region-circle.selectable {
        cursor: pointer;
    }

    .region-circle.my-region {
        stroke: #10b981;
        stroke-width: 3;
    }

    .temple-indicator {
        pointer-events: none;
    }

    .army-count {
        pointer-events: none;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    }

    .region-name {
        pointer-events: none;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    }

    .upgrade-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e293b;
        border: 1px solid #475569;
        border-radius: 0.5rem;
        padding: 1.5rem;
        min-width: 300px;
        z-index: 1000;
    }

    .upgrade-panel h3 {
        margin: 0 0 1rem 0;
        color: #f1f5f9;
    }

    .upgrade-options {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .upgrade-options button {
        padding: 0.75rem;
        border: none;
        border-radius: 0.25rem;
        background: #475569;
        color: white;
        cursor: pointer;
        transition: background 0.2s ease;
    }

    .upgrade-options button:hover {
        background: #64748b;
    }

    .close-panel {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.25rem;
        background: #6b7280;
        color: white;
        cursor: pointer;
        width: 100%;
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
            height: 200px;
        }

        .game-map {
            padding: 1rem;
        }

        .map-svg {
            max-height: 400px;
        }
    }
</style>
