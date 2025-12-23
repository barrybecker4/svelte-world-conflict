<script lang="ts">
  import '../app.css';

  // Load AdSense script if publisher ID is configured
  $: publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;
  $: adsEnabled = typeof window !== 'undefined' && publisherId;
</script>

<svelte:head>
  {#if publisherId}
    <!-- Google AdSense verification -->
    <meta name="google-adsense-account" content={publisherId} />
  {/if}
  {#if adsEnabled}
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={publisherId}"
      crossorigin="anonymous"
    ></script>
  {/if}
</svelte:head>

<main>
  <slot />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
    min-height: 100vh;
  }

  /* Global game-specific styles */
  :global(.game-button) {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  :global(.game-button-primary) {
    background-color: #7c3aed;
    color: white;
  }

  :global(.game-button-primary:hover) {
    background-color: #6d28d9;
  }

  :global(.game-button-secondary) {
    background-color: #4b5563;
    color: white;
    border: 1px solid #6b7280;
  }

  :global(.game-button-secondary:hover) {
    background-color: #374151;
  }

  :global(.game-panel) {
    background-color: rgba(15, 15, 26, 0.95);
    border: 1px solid #374151;
    border-radius: 0.5rem;
    backdrop-filter: blur(4px);
  }
</style>

