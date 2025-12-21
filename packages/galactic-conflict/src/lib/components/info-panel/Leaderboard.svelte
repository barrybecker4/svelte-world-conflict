<script lang="ts">
    import type { Player } from '$lib/game/entities/gameTypes';
    import { getPlayerColor } from '$lib/game/constants/playerConfigs';

    export let sortedPlayers: Array<Player & { planets: number; ships: number }>;
    export let currentPlayerId: number | null;
    export let eliminatedPlayers: number[];
</script>

<div class="leaderboard">
    <h3>Leaderboard</h3>
    <div class="player-list">
        {#each sortedPlayers as player, index}
            <div
                class="player-row"
                class:current={player.slotIndex === currentPlayerId}
                class:eliminated={eliminatedPlayers.includes(player.slotIndex)}
            >
                <span class="rank">#{index + 1}</span>
                <span
                    class="player-color"
                    style="background-color: {getPlayerColor(player.slotIndex)}"
                ></span>
                <span class="player-name">{player.name}</span>
                <span class="player-stats">
                    {player.planets}🪐 {player.ships}🚀
                </span>
            </div>
        {/each}
    </div>
</div>

<style>
    .leaderboard {
        margin-bottom: 1.5rem;
    }

    h3 {
        font-size: 0.9rem;
        color: #9ca3af;
        margin: 0 0 0.5rem 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
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
</style>

