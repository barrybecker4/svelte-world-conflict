<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { GameApiClient } from '$lib/client/gameController/GameApiClient';
    import { loadPlayerName, savePlayerName, saveGameCreator } from '$lib/client/stores/clientStorage';
    import { goto } from '$app/navigation';
    import { logger } from 'multiplayer-framework/shared';

    const dispatch = createEventDispatcher();

    let games: any[] = [];
    let loading = true;
    let error: string | null = null;
    let playerName = '';
    let showNameInput = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        const storedName = loadPlayerName();
        if (storedName) {
            playerName = storedName;
            showNameInput = false;
            await loadGames();
            startPolling();
        }
    });

    onDestroy(() => {
        stopPolling();
    });

    function startPolling() {
        // Poll every 5 seconds for new games
        pollInterval = setInterval(() => {
            loadGames();
        }, 5000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function loadGames() {
        loading = true;
        error = null;
        try {
            const result = await GameApiClient.getOpenGames();
            games = result.games || [];
            // Don't auto-close when no games - let users stay in lobby to wait
            // or click "New Game" to create one
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load games';
            logger.error('Failed to load games:', err);
        } finally {
            loading = false;
        }
    }

    function handleNameSubmit() {
        if (playerName.trim()) {
            savePlayerName(playerName.trim());
            showNameInput = false;
            loadGames();
            startPolling();
        }
    }

    async function handleJoinGame(gameId: string, slotIndex: number) {
        try {
            stopPolling();
            const result = await GameApiClient.joinGame(gameId, playerName, slotIndex);
            if (result.success && result.player) {
                // Save player info to localStorage so they can be identified when game loads
                saveGameCreator(gameId, {
                    playerId: result.player.slotIndex.toString(),
                    playerSlotIndex: result.player.slotIndex,
                    playerName: result.player.name
                });
                await goto(`/game/${gameId}`);
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to join game';
            startPolling(); // Resume polling if join failed
        }
    }

    function handleNewGame() {
        stopPolling();
        dispatch('close');
    }

    function getOpenSlots(game: any) {
        return game.playerSlots?.filter((s: any) => s.type === 'Open') || [];
    }
</script>

<div class="lobby-overlay">
    {#if showNameInput}
        <div class="name-input-container">
            <h2>Enter Your Name</h2>
            <form on:submit|preventDefault={handleNameSubmit}>
                <input
                    type="text"
                    bind:value={playerName}
                    placeholder="Commander name..."
                    maxlength="20"
                    autofocus
                />
                <button type="submit" disabled={!playerName.trim()}>
                    Continue
                </button>
            </form>
        </div>
    {:else}
        <div class="lobby-container">
            <header>
                <h1>Galactic Conflict</h1>
                <p class="subtitle">Select a game to join or create a new one</p>
            </header>

            <div class="content">
                {#if error}
                    <div class="error">{error}</div>
                {/if}

                {#if loading}
                    <div class="loading">Loading games...</div>
                {:else if games.length > 0}
                    <div class="games-list">
                        <h3>Open Games ({games.length})</h3>
                        {#each games as game}
                            {@const playerCount = game.players?.length || game.playerSlots?.length || 0}
                            {@const neutralPlanets = game.settings?.neutralPlanetCount ?? (game.settings?.planetCount ? game.settings.planetCount - playerCount : 8)}
                            {@const totalPlanets = playerCount + neutralPlanets}
                            <div class="game-card">
                                <div class="game-info">
                                    <span class="game-id">Game: {game.gameId}</span>
                                    <span class="player-count">
                                        {game.players?.length || 0}/{game.playerSlots?.length || 0} players
                                    </span>
                                </div>
                                <div class="settings-preview">
                                    <span>🪐 {totalPlanets} planets ({neutralPlanets} neutral)</span>
                                    <span>⏱️ {game.settings?.gameDuration || 15}min</span>
                                </div>
                                <div class="slots">
                                    {#each getOpenSlots(game) as slot}
                                        <button
                                            class="slot-btn"
                                            on:click={() => handleJoinGame(game.gameId, slot.slotIndex)}
                                        >
                                            Join Slot {slot.slotIndex + 1}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="no-games">
                        <p class="no-games-title">No games available</p>
                        <p class="no-games-subtitle">Waiting for open games... Create one to get started!</p>
                    </div>
                {/if}
            </div>

            <footer>
                <button class="new-game-btn" on:click={handleNewGame}>
                    + New Game
                </button>
            </footer>
        </div>
    {/if}
</div>

<style>
    .lobby-overlay {
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

    .name-input-container {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        padding: 2rem;
        text-align: center;
        color: #e5e7eb;
    }

    .name-input-container h2 {
        margin: 0 0 1.5rem;
        color: #a78bfa;
    }

    .name-input-container form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .name-input-container input {
        padding: 0.75rem 1rem;
        font-size: 1.1rem;
        background: #1f1f2e;
        border: 1px solid #374151;
        border-radius: 8px;
        color: #e5e7eb;
        text-align: center;
    }

    .name-input-container button {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .name-input-container button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .lobby-container {
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 2px solid #4c1d95;
        border-radius: 16px;
        width: 100%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        color: #e5e7eb;
    }

    header {
        text-align: center;
        padding: 1.5rem;
        border-bottom: 1px solid #374151;
    }

    h1 {
        margin: 0;
        font-size: 1.75rem;
        color: #a78bfa;
    }

    .subtitle {
        margin: 0.5rem 0 0;
        color: #9ca3af;
    }

    .content {
        padding: 1.5rem;
        min-height: 200px;
    }

    h3 {
        margin: 0 0 1rem;
        color: #e5e7eb;
    }

    .error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid #ef4444;
        padding: 0.75rem;
        border-radius: 8px;
        color: #fca5a5;
        margin-bottom: 1rem;
    }

    .loading {
        text-align: center;
        color: #9ca3af;
        padding: 2rem;
    }

    .no-games {
        text-align: center;
        padding: 2rem;
    }

    .no-games-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #e5e7eb;
        margin: 0 0 0.5rem;
    }

    .no-games-subtitle {
        color: #9ca3af;
        margin: 0;
    }

    .games-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .game-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 1rem;
    }

    .game-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .game-id {
        font-weight: 500;
    }

    .player-count {
        color: #9ca3af;
    }

    .settings-preview {
        display: flex;
        gap: 1rem;
        font-size: 0.85rem;
        color: #9ca3af;
        margin-bottom: 0.75rem;
    }

    .slots {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .slot-btn {
        padding: 0.5rem 1rem;
        background: #374151;
        border: none;
        border-radius: 4px;
        color: #e5e7eb;
        cursor: pointer;
        font-size: 0.85rem;
    }

    .slot-btn:hover {
        background: #4b5563;
    }

    footer {
        padding: 1.5rem;
        border-top: 1px solid #374151;
        text-align: center;
    }

    .new-game-btn {
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
    }

    .new-game-btn:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
    }
</style>

