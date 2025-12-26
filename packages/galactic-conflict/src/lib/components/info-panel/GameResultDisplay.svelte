<script lang="ts">
    import type { GalacticGameStateData } from '$lib/game/entities/gameTypes';

    export let gameState: GalacticGameStateData;
    export let currentPlayerId: number | null;
    export let onNewGame: (() => void) | null = null;

    $: isWinner = gameState.endResult !== 'DRAWN_GAME' && 
                   gameState.endResult !== null &&
                   typeof gameState.endResult === 'object' &&
                   gameState.endResult.slotIndex === currentPlayerId;
    $: isDraw = gameState.endResult === 'DRAWN_GAME';
</script>

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

<style>
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
    
    h3 {
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
</style>
