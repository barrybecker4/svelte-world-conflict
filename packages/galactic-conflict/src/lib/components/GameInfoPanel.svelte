<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { GalacticGameStateData, Player } from '$lib/game/entities/gameTypes';
    import { isGameCompleted, isPlayerEliminated } from '$lib/client/utils/gameStateChecks';
    import { AudioButton } from 'shared-ui';
    import { audioSystem, SOUNDS } from '$lib/client/audio';
    import { battleAnimations } from '$lib/client/stores/battleAnimationStore';
    import PlayerStatsDisplay from './info-panel/PlayerStatsDisplay.svelte';
    import Leaderboard from './info-panel/Leaderboard.svelte';
    import GameResultDisplay from './info-panel/GameResultDisplay.svelte';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null = null;
    export let isConnected: boolean = false;
    export let onNewGame: (() => void) | null = null;
    export let onResign: (() => void) | null = null;
    export let onLeave: (() => void) | null = null;
    export let hasResigned: boolean = false;

    // Check if current player is eliminated (resigned or defeated)
    $: isEliminated = isPlayerEliminated(gameState, currentPlayerId);

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
    $: shouldShowGameOver = isGameCompleted(gameState) && $battleAnimations.size === 0;
    
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
        <PlayerStatsDisplay
            myPlanets={myPlanets.length}
            {totalShips}
            {totalResources}
            armadaCount={gameState.armadas.filter(a => a.ownerId === currentPlayerId).length}
        />
    {/if}

    <!-- Leaderboard -->
    <Leaderboard
        sortedPlayers={sortedPlayers.map(p => ({ ...p, ...getPlayerStats(p) }))}
        {currentPlayerId}
        eliminatedPlayers={gameState.eliminatedPlayers}
    />

    <!-- Game result -->
    {#if shouldShowGameOver}
        <GameResultDisplay
            {gameState}
            {currentPlayerId}
            {onNewGame}
        />
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
        <AudioButton {audioSystem} testSound={SOUNDS.CLICK} />
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

