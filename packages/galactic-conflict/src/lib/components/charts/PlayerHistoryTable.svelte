<script lang="ts">
    import type { DailyGameStats } from '$lib/server/storage/types';

    export let stats: DailyGameStats[];
</script>

<div class="table-cell">
    <h3>Who Played</h3>
    <div class="player-table-wrapper">
        <table class="player-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Players</th>
                </tr>
            </thead>
            <tbody>
                {#each stats as stat}
                    <tr>
                        <td class="date-cell">{stat.date}</td>
                        <td class="players-cell">
                            {#if stat.uniquePlayerNames && stat.uniquePlayerNames.length > 0}
                                {stat.uniquePlayerNames.join(', ')}
                            {:else}
                                <span class="no-players">-</span>
                            {/if}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    .table-cell {
        grid-column: span 2;
        background: rgba(15, 23, 42, 0.6);
        border-radius: 8px;
        padding: 12px;
        border: 1px solid rgba(71, 85, 105, 0.5);
    }

    h3 {
        margin: 0 0 12px 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: #f8fafc;
        text-align: center;
    }

    .player-table-wrapper {
        max-height: 200px;
        overflow-y: auto;
    }

    .player-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
    }

    .player-table th {
        position: sticky;
        top: 0;
        background: rgba(30, 41, 59, 0.95);
        color: #94a3b8;
        font-weight: 600;
        text-align: left;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(71, 85, 105, 0.5);
    }

    .player-table td {
        padding: 6px 12px;
        border-bottom: 1px solid rgba(71, 85, 105, 0.2);
        color: #cbd5e1;
    }

    .player-table tr:hover td {
        background: rgba(59, 130, 246, 0.1);
    }

    .date-cell {
        white-space: nowrap;
        font-family: monospace;
        color: #94a3b8;
        width: 100px;
    }

    .players-cell {
        word-break: break-word;
    }

    .no-players {
        color: #64748b;
        font-style: italic;
    }

    @media (max-width: 768px) {
        .table-cell {
            grid-column: span 1;
        }
    }
</style>

