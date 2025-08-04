<script lang="ts">
  export let size = 'md'; // xs, sm, md, lg, xl
  export let color = 'primary'; // primary, blue, teal, white
  export let text = '';
  export let className = '';

  $: spinnerClasses = [
    'loading-spinner',
    `spinner-${size}`,
    `spinner-${color}`,
    className
  ].filter(Boolean).join(' ');
</script>

<div class="loading-container">
  <div class={spinnerClasses}></div>
  {#if text}
    <p class="loading-text">{text}</p>
  {/if}
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .loading-spinner {
    border-radius: 50%;
    animation: spin 1s linear infinite;
    border-style: solid;
    border-color: transparent;
  }

  /* Sizes */
  .spinner-xs {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  .spinner-sm {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  .spinner-md {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }

  .spinner-lg {
    width: 40px;
    height: 40px;
    border-width: 3px;
  }

  .spinner-xl {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  /* Colors */
  .spinner-primary {
    border-top-color: #3b82f6;
    border-right-color: #3b82f6;
    border-bottom-color: #374151;
    border-left-color: #374151;
  }

  .spinner-blue {
    border-top-color: #60a5fa;
    border-right-color: #60a5fa;
    border-bottom-color: #475569;
    border-left-color: #475569;
  }

  .spinner-teal {
    border-top-color: #3498db;
    border-right-color: #3498db;
    border-bottom-color: #34495e;
    border-left-color: #34495e;
  }

  .spinner-white {
    border-top-color: white;
    border-right-color: white;
    border-bottom-color: rgba(255, 255, 255, 0.3);
    border-left-color: rgba(255, 255, 255, 0.3);
  }

  .loading-text {
    margin: 0;
    color: #e2e8f0;
    font-size: 0.9rem;
    text-align: center;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
