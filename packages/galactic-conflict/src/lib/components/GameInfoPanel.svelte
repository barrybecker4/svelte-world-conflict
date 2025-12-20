<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { GalacticGameStateData, Player } from '$lib/game/entities/gameTypes';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';
    import AudioButton from './configuration/AudioButton.svelte';
    import { battleAnimations } from '$lib/client/stores/battleAnimationStore';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let isConnected: boolean = false;
    export let onNewGame: (() => void) | null = null;
    export let onResign: (() => void) | null = null;
    export let onLeave: (() => void) | null = null;
    export let hasResigned: boolean = false;

    // Check if current player is eliminated (resigned or defeated)
    $: isEliminated = gameState.eliminatedPlayers?.includes(currentPlayerId ?? -1) ?? false;

    // Time tracking with interval for live updates
    let currentTime = Date.now();
    let timerInterval: ReturnType<typeof setInterval>;

    onMount(() => {
        timerInterval = setInterval(() => {
            currentTime = Date.now();
        }, 1000);
    });

    onDestroy(() => {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
    });

    $: currentPlayer = gameState.players.find(p => p.slotIndex === currentPlayerId);
    $: myPlanets = gameState.planets.filter(p => p.ownerId === currentPlayerId);
    $: myShipsOnPlanets = myPlanets.reduce((sum, p) => sum + p.ships, 0);
    $: myArmadaShips = gameState.armadas
        .filter(a => a.ownerId === currentPlayerId)
        .reduce((sum, a) => sum + a.ships, 0);
    $: totalShips = myShipsOnPlanets + myArmadaShips;
    $: totalResources = currentPlayerId !== null ? (gameState.resourcesByPlayer?.[currentPlayerId] ?? 0) : 0;
    
    $: timeRemaining = Math.max(0, (gameState.startTime + gameState.durationMinutes * 60 * 1000) - currentTime);
    $: minutesRemaining = Math.floor(timeRemaining / 60000);
    $: secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);

    function getPlayerStats(player: Player) {
        const planets = gameState.planets.filter(p => p.ownerId === player.slotIndex);
        const ships = planets.reduce((sum, p) => sum + p.ships, 0) +
            gameState.armadas.filter(a => a.ownerId === player.slotIndex).reduce((sum, a) => sum + a.ships, 0);
        return { planets: planets.length, ships };
    }

    // Sort players by planets owned (descending)
    $: sortedPlayers = [...gameState.players].sort((a, b) => {
        const aStats = getPlayerStats(a);
        const bStats = getPlayerStats(b);
        if (aStats.planets !== bStats.planets) return bStats.planets - aStats.planets;
        return bStats.ships - aStats.ships;
    });

    // Delay showing game over until all battle animations complete
    // Don't check hasUnprocessedReplays - just wait for animations to finish
    // (Replays get cleared from state after being sent, but animations continue)
    $: shouldShowGameOver = gameState.status === 'COMPLETED' && $battleAnimations.size === 0;
    
    // Delay showing eliminated/resigned message until battle animations complete
    $: shouldShowEliminatedMessage = (isEliminated || hasResigned) && $battleAnimations.size === 0;
</script>

<div class="panel">
    <!-- Connection status -->
    <div class="connection-status" class:connected={isConnected}>
        <span class="status-dot"></span>
        {isConnected ? 'Connected' : 'Disconnected'}
    </div>

    <!-- Game timer -->
    <div class="timer-section">
        <h3>Time Remaining</h3>
        <div class="timer">
            {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>
    </div>

    <!-- Current player stats -->
    {#if currentPlayer}
        <div class="my-stats">
            <h3>Your Empire</h3>
            <div class="stat-grid">
                <div class="stat">
                    <span class="stat-label">Planets</span>
                    <span class="stat-value">{myPlanets.length}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Ships</span>
                    <span class="stat-value">{totalShips}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Resources</span>
                    <span class="stat-value">{Math.floor(totalResources)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Armadas</span>
                    <span class="stat-value">{gameState.armadas.filter(a => a.ownerId === currentPlayerId).length}</span>
                </div>
            </div>
        </div>
    {/if}

    <!-- Leaderboard -->
    <div class="leaderboard">
        <h3>Leaderboard</h3>
        <div class="player-list">
            {#each sortedPlayers as player, index}
                {@const stats = getPlayerStats(player)}
                {@const isEliminated = gameState.eliminatedPlayers.includes(player.slotIndex)}
                <div
                    class="player-row"
                    class:current={player.slotIndex === currentPlayerId}
                    class:eliminated={isEliminated}
                >
                    <span class="rank">#{index + 1}</span>
                    <span
                        class="player-color"
                        style="background-color: {getPlayerColor(player.slotIndex)}"
                    ></span>
                    <span class="player-name">{player.name}</span>
                    <span class="player-stats">
                        {stats.planets}🪐 {stats.ships}🚀
                    </span>
                </div>
            {/each}
        </div>
    </div>

    <!-- Game result -->
    {#if shouldShowGameOver}
        {@const isWinner = gameState.endResult !== 'DRAWN_GAME' && 
                           gameState.endResult !== null &&
                           typeof gameState.endResult === 'object' &&
                           gameState.endResult.slotIndex === currentPlayerId}
        {@const isDraw = gameState.endResult === 'DRAWN_GAME'}
        <div class="game-result" class:victory={isWinner} class:defeat={!isWinner && !isDraw}>
            <h3>
                {#if isDraw}
                    🎯 Draw!
                {:else if isWinner}
                    🏆 Victory!
                {:else}
                    💀 Defeat
                {/if}
            </h3>
            {#if isDraw}
                <p class="result-text draw">The game ended in a draw!</p>
            {:else if isWinner}
                <p class="result-text winner">Congratulations! You have conquered the galaxy!</p>
            {:else if gameState.endResult && typeof gameState.endResult === 'object'}
                <p class="result-text loser">
                    <span class="winner-name" style="color: {gameState.endResult.color}">
                        {gameState.endResult.name}
                    </span> has conquered the galaxy!
                </p>
            {/if}
            {#if onNewGame}
                <button class="new-game-btn" on:click={onNewGame}>
                    New Game
                </button>
            {/if}
        </div>
    {/if}

    <!-- Resign/Leave section -->
    {#if !shouldShowGameOver}
        <div class="action-section">
            {#if shouldShowEliminatedMessage}
                <div class="resigned-notice">
                    {#if hasResigned}
                        <p>You have resigned. You can continue watching.</p>
                    {:else if isEliminated}
                        <p>You have been defeated. You can continue watching.</p>
                    {/if}
                    {#if onLeave}
                        <button class="leave-btn" on:click={onLeave}>
                            Leave Game
                        </button>
                    {/if}
                </div>
            {:else if onResign && !isEliminated && !hasResigned && gameState.status !== 'COMPLETED'}
                <button class="resign-btn" on:click={onResign}>
                    Resign
                </button>
            {/if}
        </div>
    {/if}

    <!-- Icon buttons row -->
    <div class="icon-buttons">
        <AudioButton />
    </div>
</div>

<style>
    .panel {
        padding: 1rem;
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        min-height: 100%;
    }

    h3 {
        font-size: 0.9rem;
        color: #9ca3af;
        margin: 0 0 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .connection-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: #ef4444;
        margin-bottom: 1rem;
    }

    .connection-status.connected {
        color: #22c55e;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
    }

    .timer-section {
        margin-bottom: 1.5rem;
        text-align: center;
    }

    .timer {
        font-size: 2rem;
        font-weight: bold;
        color: #a78bfa;
        font-family: monospace;
    }

    .my-stats {
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.3);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .stat-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .stat {
        text-align: center;
    }

    .stat-label {
        display: block;
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .stat-value {
        display: block;
        font-size: 1.25rem;
        font-weight: bold;
        color: #e5e7eb;
    }

    .leaderboard {
        margin-bottom: 1.5rem;
    }

    .player-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .player-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-size: 0.85rem;
    }

    .player-row.current {
        background: rgba(168, 85, 247, 0.2);
        border: 1px solid rgba(168, 85, 247, 0.4);
    }

    .player-row.eliminated {
        opacity: 0.5;
        text-decoration: line-through;
    }

    .rank {
        color: #9ca3af;
        width: 24px;
    }

    .player-color {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }

    .player-name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .player-stats {
        color: #9ca3af;
        font-size: 0.8rem;
    }

    .game-result {
        text-align: center;
        padding: 1.5rem;
        background: rgba(168, 85, 247, 0.2);
        border: 1px solid rgba(168, 85, 247, 0.4);
        border-radius: 8px;
        animation: slideIn 0.5s ease-out;
    }
    
    .game-result.victory {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.4);
    }
    
    .game-result.defeat {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
    }
    
    @keyframes slideIn {
        0% {
            opacity: 0;
            transform: translateY(-10px);
        }
        100% {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .game-result h3 {
        font-size: 1.75rem;
        margin: 0 0 0.75rem 0;
        color: #e5e7eb;
    }

    .result-text {
        font-size: 1rem;
        font-weight: normal;
        margin: 0.5rem 0 1rem 0;
        line-height: 1.5;
        color: #d1d5db;
    }

    .result-text.winner {
        color: #22c55e;
    }
    
    .result-text.loser {
        color: #e5e7eb;
    }

    .result-text.draw {
        color: #fbbf24;
    }
    
    .winner-name {
        font-weight: bold;
        text-shadow: 0 0 8px currentColor;
    }

    .new-game-btn {
        margin-top: 1rem;
        padding: 0.75rem 2rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: transform 0.2s, background 0.2s;
    }

    .new-game-btn:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
        transform: scale(1.05);
    }

    /* Action section */
    .action-section {
        margin-top: auto;
        padding-top: 1rem;
        border-top: 1px solid #374151;
    }

    .resigned-notice {
        text-align: center;
    }

    .resigned-notice p {
        color: #9ca3af;
        font-size: 0.85rem;
        margin: 0 0 0.75rem 0;
    }

    .resign-btn {
        width: 100%;
        padding: 0.75rem 1.5rem;
        background: transparent;
        border: 1px solid #dc2626;
        border-radius: 8px;
        color: #f87171;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .resign-btn:hover {
        background: rgba(220, 38, 38, 0.15);
        border-color: #ef4444;
        color: #fca5a5;
    }

    .leave-btn {
        width: 100%;
        padding: 0.75rem 1.5rem;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        border: none;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .leave-btn:hover {
        background: linear-gradient(135deg, #6d28d9, #9333ea);
        transform: scale(1.02);
    }

    /* Icon buttons */
    .icon-buttons {
        display: flex;
        gap: 0.5rem;
        padding-top: 1rem;
        border-top: 1px solid #374151;
        margin-top: 1rem;
    }
</style>

