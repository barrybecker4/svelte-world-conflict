<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import type { DailyGameStats } from '$lib/server/storage/types';

  interface Props {
    isOpen: boolean;
    onclose?: () => void;
  }

  let { isOpen = $bindable(), onclose }: Props = $props();

  let stats: DailyGameStats[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  const CHART_COLORS = {
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#a855f7',
    red: '#ef4444',
    orange: '#f97316',
    pink: '#ec4899',
    cyan: '#06b6d4'
  };

  async function fetchStats() {
    loading = true;
    error = null;
    
    try {
      const response = await fetch('/api/admin/stats?days=14');
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      stats = data.stats || [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    isOpen = false;
    onclose?.();
  }

  // Computed data for charts
  const dateLabels = $derived(stats.map(s => {
    const date = new Date(s.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }));

  const gamesPlayedDatasets = $derived([
    { label: 'Games Started', data: stats.map(s => s.gamesStarted), color: CHART_COLORS.blue },
    { label: 'Completed', data: stats.map(s => s.completedGames), color: CHART_COLORS.green },
    { label: 'Incomplete', data: stats.map(s => s.incompleteGames), color: CHART_COLORS.red },
    { label: 'Multi-Human', data: stats.map(s => s.gamesWithMultipleHumans), color: CHART_COLORS.purple }
  ]);

  const turnsPlayedDatasets = $derived([
    { label: 'Min Turns', data: stats.map(s => s.minTurns === Infinity || s.minTurns === null ? 0 : s.minTurns), color: CHART_COLORS.cyan },
    { label: 'Max Turns', data: stats.map(s => s.maxTurns), color: CHART_COLORS.orange },
    { label: 'Total Turns', data: stats.map(s => s.totalTurns), color: CHART_COLORS.yellow }
  ]);

  const endReasonsDatasets = $derived([
    { label: 'Completed', data: stats.map(s => s.completedGames), color: CHART_COLORS.green },
    { label: 'Elimination', data: stats.map(s => s.endReasons?.elimination ?? 0), color: CHART_COLORS.red },
    { label: 'Turn Limit', data: stats.map(s => s.endReasons?.turnLimit ?? 0), color: CHART_COLORS.yellow },
    { label: 'Resignation', data: stats.map(s => s.endReasons?.resignation ?? 0), color: CHART_COLORS.purple }
  ]);

  onMount(() => {
    if (isOpen) {
      fetchStats();
    }
  });

  // Fetch when modal opens
  $effect(() => {
    if (isOpen && stats.length === 0) {
      fetchStats();
    }
  });
</script>

<Modal
  {isOpen}
  title="Historical Statistics"
  width="900px"
  height="85vh"
  on:close={handleClose}
>
  <div class="stats-container">
    {#if loading}
      <div class="loading-state">
        <Spinner size="lg" />
        <p>Loading statistics...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p>⚠️ {error}</p>
        <Button variant="secondary" on:click={fetchStats}>Retry</Button>
      </div>
    {:else if stats.length === 0}
      <div class="empty-state">
        <p>No statistics available yet.</p>
        <p class="hint">Play some games to start collecting data!</p>
      </div>
    {:else}
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
            title="Turns Played"
            labels={dateLabels}
            datasets={turnsPlayedDatasets}
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
      </div>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={handleClose}>Close</Button>
  </svelte:fragment>
</Modal>

<style>
  .stats-container {
    min-height: 400px;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 16px;
    color: #94a3b8;
  }

  .error-state p {
    color: #fca5a5;
  }

  .empty-state .hint {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .chart-cell {
    min-height: 220px;
  }

  .table-cell {
    grid-column: span 2;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(71, 85, 105, 0.5);
  }

  .table-cell h3 {
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
    .charts-grid {
      grid-template-columns: 1fr;
    }

    .table-cell {
      grid-column: span 1;
    }
  }
</style>

