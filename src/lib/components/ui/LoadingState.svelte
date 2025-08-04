<script lang="ts">
  import Spinner from './Spinner.svelte';
  import Button from './Button.svelte';

  export let loading = false;
  export let error = null;
  export let loadingText = 'Loading...';
  export let spinnerSize = 'lg';
  export let spinnerColor = 'teal';
  export let showRetry = false;
  export let retryText = 'Try Again';
  export let containerClass = '';

  // Event dispatcher for retry action
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleRetry() {
    dispatch('retry');
  }
</script>

{#if loading}
  <div class="loading-container {containerClass}">
    <Spinner size={spinnerSize} color={spinnerColor} text={loadingText} />
  </div>
{:else if error}
  <div class="error-container {containerClass}">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3 class="error-title">Error</h3>
      <p class="error-message">{error}</p>

      <div class="error-actions">
        {#if showRetry}
          <Button variant="primary" on:click={handleRetry}>
            {retryText}
          </Button>
        {/if}
        <slot name="error-actions" />
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 200px;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 200px;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
    padding: 2rem;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-title {
    color: #ef4444;
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .error-message {
    color: #cbd5e1;
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
    font-size: 1rem;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* Variants for different contexts */
  .loading-container.fullscreen,
  .error-container.fullscreen {
    height: 100vh;
    min-height: 100vh;
  }

  .loading-container.card,
  .error-container.card {
    min-height: 150px;
    border-radius: 12px;
    border: 1px solid #4a5568;
  }

  .loading-container.inline,
  .error-container.inline {
    min-height: 100px;
    padding: 1rem;
  }
</style>