<script lang="ts">
  import { onMount } from 'svelte';
  import LineChart from '$lib/components/charts/LineChart.svelte';
  import type { DailyGameStats } from '$lib/server/storage/types';

  interface Props {
    isOpen?: boolean;
    onclose?: () => void;
  }

  let { isOpen = $bindable(false), onclose }: Props = $props();

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
      const data = (await response.json()) as { stats?: DailyGameStats[]; error?: string };
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to fetch stats: ${response.status}`);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      stats = data.stats ?? [];
    } catch (e) {
      console.error('Error fetching stats:', e);
      error = e instanceof Error ? e.message : 'Unknown error';
      stats = []; // Ensure stats is set even on error
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

  const durationDatasets = $derived([
    { label: 'Min Duration (min)', data: stats.map(s => s.minDurationMinutes === Infinity || s.minDurationMinutes === null ? 0 : Math.round(s.minDurationMinutes)), color: CHART_COLORS.cyan },
    { label: 'Max Duration (min)', data: stats.map(s => Math.round(s.maxDurationMinutes)), color: CHART_COLORS.orange },
    { label: 'Avg Duration (min)', data: stats.map(s => s.completedGames > 0 ? Math.round(s.totalDurationMinutes / s.completedGames) : 0), color: CHART_COLORS.yellow }
  ]);

  const endReasonsDatasets = $derived([
    { label: 'Elimination', data: stats.map(s => s.endReasons?.elimination ?? 0), color: CHART_COLORS.red },
    { label: 'Time Limit', data: stats.map(s => s.endReasons?.timeLimit ?? 0), color: CHART_COLORS.yellow },
    { label: 'Resignation', data: stats.map(s => s.endReasons?.resignation ?? 0), color: CHART_COLORS.purple }
  ]);

  // Fetch when modal opens
  $effect(() => {
    if (isOpen) {
      fetchStats();
    }
  });
</script>

{#if isOpen}
<div class="modal-overlay" on:click={handleClose} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && handleClose()}>
  <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true" aria-labelledby="stats-modal-title">
    <header>
      <h2 id="stats-modal-title">Historical Statistics</h2>
      <button class="close-btn" on:click={handleClose}>×</button>
    </header>

    <div class="content">
      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading statistics...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p>⚠️ {error}</p>
          <button class="retry-btn" on:click={fetchStats}>Retry</button>
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

    <footer>
      <button class="close-button" on:click={handleClose}>Close</button>
    </footer>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: linear-gradient(145deg, #1a1a2e, #16162a);
    border: 1px solid #374151;
    border-radius: 16px;
    max-width: 900px;
    width: 90%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #374151;
  }

  h2 {
    margin: 0;
    color: #a78bfa;
    font-size: 1.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 2rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
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

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(167, 139, 250, 0.2);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state p {
    color: #fca5a5;
  }

  .retry-btn {
    padding: 0.5rem 1rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    color: #e5e7eb;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .retry-btn:hover {
    background: #4b5563;
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

  footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #374151;
    display: flex;
    justify-content: flex-end;
  }

  .close-button {
    padding: 0.5rem 1.5rem;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    color: #e5e7eb;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #4b5563;
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

