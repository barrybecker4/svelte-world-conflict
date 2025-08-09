<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import IconButton from './IconButton.svelte';

  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let title = '';
  export let showHeader = true;
  export let showCloseButton = true;
  export let maxWidth = '400px';
  export let maxHeight = '90vh';

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function handleBackdropClick() {
    handleClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div
      class="modal-container"
      style="max-width: {maxWidth}; max-height: {maxHeight}"
      on:click|stopPropagation
      role="dialog"
      aria-labelledby={showHeader ? "modal-title" : undefined}
    >
      {#if showHeader}
        <div class="modal-header">
          <h2 id="modal-title">{title}</h2>
          {#if showCloseButton}
            <IconButton variant="default" size="sm" title="Close" on:click={handleClose}>
              ✕
            </IconButton>
          {/if}
        </div>
      {/if}

      <div class="modal-content">
        <slot />
      </div>

      <slot name="footer" />
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-overlay, rgba(0, 0, 0, 0.7));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal, 1000);
    backdrop-filter: blur(4px);
  }

  .modal-container {
    background: var(--bg-panel-dark, linear-gradient(145deg, #2d3748, #1a202c));
    border-radius: var(--radius-xl, 12px);
    border: 1px solid var(--border-light, #4a5568);
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.4));
    width: 90%;
    overflow: hidden;
    color: var(--text-primary, white);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-6, 1.5rem);
    border-bottom: 1px solid var(--border-light, #4a5568);
    background: rgba(0, 0, 0, 0.2);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--text-xl, 1.2rem);
    color: var(--text-primary, #f7fafc);
  }

  .modal-content {
    padding: var(--space-6, 1.5rem);
  }

  /* Global modal footer styles for slotted content */
  :global(.modal-footer) {
    display: flex;
    gap: var(--space-3, 0.75rem);
    justify-content: flex-end;
    padding: var(--space-6, 1.5rem);
    border-top: 1px solid var(--border-light, #4a5568);
    background: rgba(0, 0, 0, 0.1);
  }
</style>