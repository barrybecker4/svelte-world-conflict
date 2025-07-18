<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import WorldConflictGame from '$lib/components/WorldConflictGame.svelte';

    // Get game ID from URL
    $: gameId = $page.params.gameId;

    // Get player info from URL params or localStorage
    let playerId: string | null = null;
    let playerIndex: number = 0;
    let loading = true;
    let error: string | null = null;

    onMount(async () => {
        // Try to get player info from URL search params first
        const urlParams = new URLSearchParams(window.location.search);
        playerId = urlParams.get('playerId');
        const playerIndexParam = urlParams.get('playerIndex');

        if (playerIndexParam) {
            playerIndex = parseInt(playerIndexParam);
        }

        // If not in URL, try localStorage
        if (!playerId) {
            const gameKey = `worldconflict_game_${gameId}`;
            const storedData = localStorage.getItem(gameKey);
            if (storedData) {
                try {
                    const data = JSON.parse(storedData);
                    playerId = data.playerId;
                    playerIndex = data.playerIndex;
                } catch (e) {
                    console.error('Failed to parse stored game data:', e);
                }
            }
        }

        // If still no player info, redirect to join game
        if (!playerId) {
            window.location.href = `/join/${gameId}`;
            return;
        }

        // Store player info for this session
        const gameKey = `worldconflict_game_${gameId}`;
        localStorage.setItem(gameKey, JSON.stringify({ playerId, playerIndex }));

        loading = false;
    });
</script>

<svelte:head>
    <title>World Conflict - Game {gameId}</title>
    <meta name="description" content="World Conflict multiplayer strategy game" />
</svelte:head>

{#if loading}
    <div class="loading-screen">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <h2>Loading World Conflict...</h2>
            <p>Preparing your strategic campaign</p>
        </div>
    </div>
{:else if error}
    <div class="error-screen">
        <div class="error-content">
            <h2>Game Error</h2>
            <p>{error}</p>
            <a href="/" class="home-link">Return to Main Menu</a>
        </div>
    </div>
{:else if playerId}
    <WorldConflictGame {gameId} {playerId} {playerIndex} />
{:else}
    <div class="error-screen">
        <div class="error-content">
            <h2>Player Not Found</h2>
            <p>Unable to identify your player in this game.</p>
            <a href={`/join/${gameId}`} class="join-link">Join Game</a>
            <a href="/" class="home-link">Return to Main Menu</a>
        </div>
    </div>
{/if}

<style>
    .loading-screen,
    .error-screen {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        font-family: system-ui, sans-serif;
    }

    .loading-content,
    .error-content {
        text-align: center;
        padding: 2rem;
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid #475569;
        max-width: 400px;
        width: 90%;
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(56, 189, 248, 0.3);
        border-top: 4px solid #38bdf8;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem auto;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .loading-content h2,
    .error-content h2 {
        margin: 0 0 0.5rem 0;
        color: #f1f5f9;
    }

    .loading-content p,
    .error-content p {
        margin: 0 0 1.5rem 0;
        color: #cbd5e1;
    }

    .home-link,
    .join-link {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        margin: 0.25rem;
        background: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 0.5rem;
        font-weight: 500;
        transition: background 0.2s ease;
    }

    .home-link:hover,
    .join-link:hover {
        background: #2563eb;
    }

    .join-link {
        background: #10b981;
    }

    .join-link:hover {
        background: #059669;
    }
</style>

<!-- src/routes/join/[gameId]/+page.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    $: gameId = $page.params.gameId;

    let playerName = '';
    let loading = false;
    let error: string | null = null;
    let gameInfo: any = null;

    onMount(async () => {
        // Load game info
        try {
            const response = await fetch(`/api/game/${gameId}`);
            if (response.ok) {
                gameInfo = await response.json();
            }
        } catch (e) {
            console.error('Failed to load game info:', e);
        }
    });

    async function joinGame() {
        if (!playerName.trim()) {
            error = 'Please enter your name';
            return;
        }

        loading = true;
        error = null;

        try {
            const response = await fetch('/api/game/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerName: playerName.trim(),
                    gameId: gameId // Try to join specific game
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to join game');
            }

            const data = await response.json();

            // Store player info
            const gameKey = `worldconflict_game_${data.gameId}`;
            localStorage.setItem(gameKey, JSON.stringify({
                playerId: data.playerId,
                playerIndex: data.playerIndex
            }));

            // Redirect to game
            window.location.href = `/game/${data.gameId}?playerId=${data.playerId}&playerIndex=${data.playerIndex}`;
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to join game';
        } finally {
            loading = false;
        }
    }
</script>

<svelte:head>
    <title>Join World Conflict Game</title>
</svelte:head>

<div class="join-page">
    <div class="join-container">
        <h1>Join World Conflict</h1>

        {#if gameInfo}
            <div class="game-info">
                <h3>Game: {gameInfo.gameId}</h3>
                <p>Players: {gameInfo.players?.length || 0}/4</p>
                <p>Status: {gameInfo.status}</p>
            </div>
        {/if}

        <form on:submit|preventDefault={joinGame}>
            <div class="input-group">
                <label for="playerName">Your Name:</label>
                <input
                    id="playerName"
                    type="text"
                    bind:value={playerName}
                    placeholder="Enter your commander name"
                    maxlength="20"
                    required
                />
            </div>

            {#if error}
                <div class="error-message">{error}</div>
            {/if}

            <button type="submit" disabled={loading} class="join-button">
                {#if loading}
                    <div class="spinner"></div>
                    Joining...
                {:else}
                    Join Battle
                {/if}
            </button>
        </form>

        <div class="back-link">
            <a href="/">← Back to Main Menu</a>
        </div>
    </div>
</div>

<style>
    .join-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        font-family: system-ui, sans-serif;
        padding: 1rem;
    }

    .join-container {
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid #475569;
        border-radius: 1rem;
        padding: 2rem;
        max-width: 400px;
        width: 100%;
        text-align: center;
    }

    h1 {
        margin: 0 0 1.5rem 0;
        color: #f1f5f9;
        font-size: 1.875rem;
    }

    .game-info {
        background: rgba(71, 85, 105, 0.3);
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
        text-align: left;
    }

    .game-info h3 {
        margin: 0 0 0.5rem 0;
        color: #38bdf8;
    }

    .game-info p {
        margin: 0.25rem 0;
        color: #cbd5e1;
    }

    .input-group {
        margin-bottom: 1rem;
        text-align: left;
    }

    label {
        display: block;
        margin-bottom: 0.5rem;
        color: #f1f5f9;
        font-weight: 500;
    }

    input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #475569;
        border-radius: 0.5rem;
        background: #334155;
        color: white;
        font-size: 1rem;
        box-sizing: border-box;
    }

    input:focus {
        outline: none;
        border-color: #38bdf8;
    }

    .error-message {
        background: #ef4444;
        color: white;
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
    }

    .join-button {
        width: 100%;
        padding: 0.875rem;
        border: none;
        border-radius: 0.5rem;
        background: #10b981;
        color: white;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
    }

    .join-button:hover:not(:disabled) {
        background: #059669;
    }

    .join-button:disabled {
        background: #6b7280;
        cursor: not-allowed;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    .back-link {
        margin-top: 1.5rem;
    }

    .back-link a {
        color: #94a3b8;
        text-decoration: none;
        font-size: 0.875rem;
    }

    .back-link a:hover {
        color: #cbd5e1;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
