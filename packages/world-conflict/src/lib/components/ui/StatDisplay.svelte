<script lang="ts">
  /**
   * Reusable stat display component for showing game statistics
   * Used in GameInfoPanel, TempleUpgradePanel, etc.
   */

  export interface StatItem {
    value: number | string;
    label: string;
    symbol?: string;  // HTML string for symbol (e.g., from SYMBOLS)
    tooltip?: string;
  }

  export let items: StatItem[] = [];
  export let columns: number = 2;
  export let compact: boolean = false;
</script>

<div class="stat-display" class:compact style="--stat-columns: {columns}">
  {#each items as item}
    <div class="stat-item" data-tooltip={item.tooltip}>
      <div class="stat-value">
        {item.value}
        {#if item.symbol}
          <span class="symbol">{@html item.symbol}</span>
        {/if}
      </div>
      {#if item.label}
        <div class="stat-label">{item.label}</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .stat-display {
    display: grid;
    grid-template-columns: repeat(var(--stat-columns), 1fr);
    gap: var(--space-2, 8px);
  }

  .stat-item {
    text-align: center;
    padding: var(--space-2, 8px);
    background: rgba(15, 23, 42, 0.4);
    border-radius: var(--radius-sm, 4px);
  }

  .stat-value {
    font-size: var(--text-xl, 1.25rem);
    font-weight: var(--font-bold, bold);
    color: var(--text-primary, #f7fafc);
    margin-bottom: 2px;
  }

  .stat-value .symbol {
    font-size: 0.8em;
    opacity: 0.7;
    margin-left: 2px;
  }

  .stat-label {
    font-size: var(--text-xs, 0.75rem);
    color: var(--text-secondary, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Compact variant - for inline stat badges */
  .stat-display.compact {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .stat-display.compact .stat-item {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(15, 23, 42, 0.6);
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border-light, #374151);
  }

  .stat-display.compact .stat-value {
    font-size: var(--text-xs, 0.75rem);
    font-weight: 600;
    color: var(--color-gray-200, #e5e7eb);
    margin-bottom: 0;
  }

  .stat-display.compact .stat-value .symbol {
    font-size: 0.9em;
    opacity: 0.8;
    margin-left: 0;
  }

  .stat-display.compact .stat-label {
    display: none;
  }
</style>

