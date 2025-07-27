<script>
  import '../app.css';
</script>

<main>
  <slot />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Global game-specific styles */
  :global(.game-button) {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  :global(.game-button-primary) {
    background-color: #2563eb;
    color: white;
  }

  :global(.game-button-primary:hover) {
    background-color: #1d4ed8;
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
    background-color: rgba(31, 41, 55, 0.9);
    border: 1px solid #374151;
    border-radius: 0.5rem;
    backdrop-filter: blur(4px);
  }
</style>
