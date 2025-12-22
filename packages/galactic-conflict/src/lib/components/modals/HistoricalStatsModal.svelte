<script lang="ts">
  import { onMount } from 'svelte';
  import { Modal, Button, Spinner } from 'shared-ui';
  import type { DailyGameStats } from '$lib/server/storage/types';
  import StatsChartsGrid from '$lib/components/charts/StatsChartsGrid.svelte';

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


  // Fetch when modal opens
  $effect(() => {
    if (isOpen) {
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
      <StatsChartsGrid
        {stats}
        {dateLabels}
        {CHART_COLORS}
      />
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
</style>

