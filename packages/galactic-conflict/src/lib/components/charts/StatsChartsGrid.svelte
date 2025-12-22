<script lang="ts">
    import { LineChart } from 'shared-ui';
    import PlayerHistoryTable from './PlayerHistoryTable.svelte';
    import type { DailyGameStats } from '$lib/server/storage/types';

    export let stats: DailyGameStats[];
    export let dateLabels: string[];
    export let CHART_COLORS: Record<string, string>;

    $: gamesPlayedDatasets = [
        { label: 'Games Started', data: stats.map(s => s.gamesStarted), color: CHART_COLORS.blue },
        { label: 'Completed', data: stats.map(s => s.completedGames), color: CHART_COLORS.green },
        { label: 'Incomplete', data: stats.map(s => s.incompleteGames), color: CHART_COLORS.red },
        { label: 'Multi-Human', data: stats.map(s => s.gamesWithMultipleHumans), color: CHART_COLORS.purple }
    ];

    $: durationDatasets = [
        { label: 'Min Duration (min)', data: stats.map(s => s.minDurationMinutes === Infinity || s.minDurationMinutes === null ? 0 : Math.round(s.minDurationMinutes)), color: CHART_COLORS.cyan },
        { label: 'Max Duration (min)', data: stats.map(s => Math.round(s.maxDurationMinutes)), color: CHART_COLORS.orange },
        { label: 'Avg Duration (min)', data: stats.map(s => s.completedGames > 0 ? Math.round(s.totalDurationMinutes / s.completedGames) : 0), color: CHART_COLORS.yellow }
    ];

    $: endReasonsDatasets = [
        { label: 'Elimination', data: stats.map(s => s.endReasons?.elimination ?? 0), color: CHART_COLORS.red },
        { label: 'Time Limit', data: stats.map(s => s.endReasons?.timeLimit ?? 0), color: CHART_COLORS.yellow },
        { label: 'Resignation', data: stats.map(s => s.endReasons?.resignation ?? 0), color: CHART_COLORS.purple }
    ];
</script>

<div class="charts-grid">
    <div class="chart-cell">
        <LineChart
            title="Games Played"
            labels={dateLabels}
            datasets={gamesPlayedDatasets}
            height="220px"
        />
    </div>
    
    <div class="chart-cell">
        <LineChart
            title="Game Duration (minutes)"
            labels={dateLabels}
            datasets={durationDatasets}
            height="220px"
        />
    </div>
    
    <div class="chart-cell">
        <LineChart
            title="Game End Reasons"
            labels={dateLabels}
            datasets={endReasonsDatasets}
            height="220px"
        />
    </div>

    <PlayerHistoryTable {stats} />
</div>

<style>
    .charts-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .chart-cell {
        min-height: 220px;
    }

    @media (max-width: 768px) {
        .charts-grid {
            grid-template-columns: 1fr;
        }
    }
</style>

