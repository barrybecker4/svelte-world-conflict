<script lang="ts">
  import type { Snippet } from 'svelte';
  import Spinner from './Spinner.svelte';
  import Button from './Button.svelte';

  interface Props {
    loading?: boolean;
    error?: string | null | undefined;
    loadingText?: string;
    spinnerSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    spinnerColor?: 'primary' | 'blue' | 'teal' | 'white';
    showRetry?: boolean;
    retryText?: string;
    containerClass?: string;
    onretry?: () => void;
    children?: Snippet;
    errorActions?: Snippet;
  }

  let {
    loading = false,
    error = null,
    loadingText = 'Loading...',
    spinnerSize = 'lg',
    spinnerColor = 'teal',
    showRetry = false,
    retryText = 'Try Again',
    containerClass = '',
    onretry,
    children,
    errorActions
  }: Props = $props();

  function handleRetry() {
    onretry?.();
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
          <Button variant="primary" onclick={handleRetry}>
            {retryText}
          </Button>
        {/if}
        {@render errorActions?.()}
      </div>
    </div>
  </div>
{:else}
  {@render children?.()}
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