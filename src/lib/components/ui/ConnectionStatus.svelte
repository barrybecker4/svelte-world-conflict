<!-- src/lib/components/shared/ConnectionStatus.svelte -->
<script lang="ts">
  export let isConnected: boolean = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
</script>

{#if isConnected}
  <span class="connection-status connected size-{size}">
    ● Live
  </span>
{:else}
  <span class="connection-status disconnected size-{size}">
    ○ Updating
  </span>
{/if}

<style>
  .connection-status {
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    transition: color 0.2s ease;
  }

  .size-sm {
    font-size: 0.75rem;
  }

  .size-md {
    font-size: 0.9rem;
  }

  .size-lg {
    font-size: 1rem;
  }

  .connected {
    color: #10b981;
  }

  .disconnected {
    color: #f59e0b;
  }
</style>
