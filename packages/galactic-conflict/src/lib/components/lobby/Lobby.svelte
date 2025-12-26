<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { GameApiClient } from '$lib/client/gameController/GameApiClient';
    import { loadPlayerName, savePlayerName, saveGameCreator } from '$lib/client/stores/clientStorage';
    import { goto } from '$app/navigation';
    import { logger } from 'multiplayer-framework/shared';
    import HistoricalStatsModal from '$lib/components/modals/HistoricalStatsModal.svelte';
    import NameInputForm from './NameInputForm.svelte';
    import GameCard from './GameCard.svelte';

    const dispatch = createEventDispatcher();

    let games: any[] = [];
    let loading = true;
    let error: string | null = null;
    let playerName = '';
    let showNameInput = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let visibilityChangeHandler: (() => void) | null = null;
    let showStats = false;
    let isEditingName = false;
    let editingName = '';
    let nameInputElement: HTMLInputElement;

    onMount(async () => {
        const storedName = loadPlayerName();
        if (storedName) {
            playerName = storedName;
            showNameInput = false;
            await loadGames();
            
            // Only start polling if page is visible
            if (!document.hidden) {
                startPolling();
            }
            
            // Stop polling when page is hidden, resume when visible
            visibilityChangeHandler = () => {
                if (document.hidden) {
                    stopPolling();
                } else {
                    // Only start if we're not already polling
                    if (!pollInterval) {
                        startPolling();
                    }
                }
            };
            document.addEventListener('visibilitychange', visibilityChangeHandler);
        }
    });

    onDestroy(() => {
        stopPolling();
        if (visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', visibilityChangeHandler);
            visibilityChangeHandler = null;
        }
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

    async function handleJoinGame(gameId: string, slotIndex: number) {
        try {
            stopPolling();
            const result = await GameApiClient.joinGame(gameId, playerName, slotIndex);
            if (result.success && result.player) {
                // Save player info to localStorage so they can be identified when game loads
                saveGameCreator(gameId, {
                    playerId: result.player.slotIndex.toString(),
                    playerSlotIndex: result.player.slotIndex,
                    playerName: result.player.name,
                    isCreator: false
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

    function handleNameSubmit(event: CustomEvent<{ playerName: string }>) {
        const { playerName: name } = event.detail;
        playerName = name;
        savePlayerName(name);
        showNameInput = false;
        loadGames();
        startPolling();
    }

    async function handleGameJoin(event: CustomEvent<{ gameId: string; slotIndex: number }>) {
        const { gameId, slotIndex } = event.detail;
        await handleJoinGame(gameId, slotIndex);
    }

    function startEditingName() {
        isEditingName = true;
        editingName = playerName;
        setTimeout(() => nameInputElement?.focus(), 0);
    }

    function cancelEditingName() {
        isEditingName = false;
        editingName = '';
    }

    function saveNameEdit() {
        const trimmedName = editingName.trim();
        if (trimmedName && trimmedName !== playerName) {
            playerName = trimmedName;
            savePlayerName(trimmedName);
        }
        isEditingName = false;
        editingName = '';
    }

    function handleNameKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveNameEdit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditingName();
        }
    }
</script>

<div class="lobby-overlay">
    {#if showNameInput}
        <NameInputForm
            {playerName}
            on:submit={handleNameSubmit}
        />
    {:else}
        <div class="lobby-container">
            <header>
                <h1>Galactic Conflict</h1>
                <p class="subtitle">
                    {#if isEditingName}
                        <input
                            bind:this={nameInputElement}
                            bind:value={editingName}
                            on:blur={saveNameEdit}
                            on:keydown={handleNameKeydown}
                            class="name-edit-input"
                            type="text"
                            maxlength="30"
                            placeholder="Enter your name"
                        />
                    {:else}
                        <span
                            class="player-name-display"
                            on:click={startEditingName}
                            on:keydown={(e) => e.key === 'Enter' && startEditingName()}
                            role="button"
                            tabindex="0"
                            title="Click to edit your name"
                        >
                            {playerName}
                        </span>
                    {/if}, select a game to join or create a new one
                </p>
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
                            <GameCard
                                {game}
                                on:join={handleGameJoin}
                            />
                        {/each}
                    </div>
                {:else}
                    <div class="no-games">
                        <p class="no-games-title">No games available</p>
                        <p class="no-games-subtitle">Waiting for open games... Create one to get started!</p>
                    </div>
                {/if}

                <div class="stats-button-container">
                    <button class="stats-btn" on:click={() => showStats = true}>
                        📊 Historical Statistics
                    </button>
                </div>
            </div>

            <footer>
                <button class="new-game-btn" on:click={handleNewGame}>
                    + New Game
                </button>
            </footer>
        </div>
    {/if}
</div>

<HistoricalStatsModal bind:isOpen={showStats} />

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
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.25rem;
    }

    .player-name-display {
        color: #a78bfa;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 0;
        border-radius: 4px;
        transition: background-color 0.2s;
        display: inline-block;
    }

    .player-name-display:hover {
        background: rgba(168, 85, 247, 0.2);
    }

    .name-edit-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #a855f7;
        border-radius: 4px;
        color: #e5e7eb;
        padding: 4px 8px;
        font-size: inherit;
        font-family: inherit;
        min-width: 100px;
        text-align: center;
    }

    .name-edit-input:focus {
        outline: none;
        border-color: #c084fc;
        background: rgba(0, 0, 0, 0.4);
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

    .stats-button-container {
        display: flex;
        justify-content: center;
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(71, 85, 105, 0.3);
    }

    .stats-btn {
        padding: 0.5rem 1rem;
        background: transparent;
        border: 1px solid #4b5563;
        border-radius: 8px;
        color: #9ca3af;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .stats-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #6b7280;
        color: #e5e7eb;
    }
</style>
