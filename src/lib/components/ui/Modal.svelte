<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import IconButton from './IconButton.svelte';
  import Panel from './Panel.svelte';
  import Section from './Section.svelte';

  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let title = '';
  export let showHeader = true;
  export let showCloseButton = true;
  export let width = '500px';
  export let height = '90vh';

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
      class="modal-wrapper"
      style="width: {width}; max-height: {height}"
      on:click|stopPropagation
      role="dialog"
      aria-labelledby={showHeader ? "modal-title" : undefined}
    >
      <Panel
        variant="dark"
        padding={false}
        customClass="modal-container"
      >

        {#if showHeader}
          <Section title={title} borderBottom={true}>
            <svelte:fragment slot="actions">
              {#if showCloseButton}
                <IconButton variant="default" size="sm" title="Close" on:click={handleClose}>
                  ✕
                </IconButton>
              {/if}
            </svelte:fragment>
          </Section>
        {/if}

        <Section title="" borderBottom={false}>
          <slot />
        </Section>

        {#if $$slots.footer}
          <Section title="" borderBottom={false} customClass="modal-footer-section">
            <div class="modal-footer">
              <slot name="footer" />
            </div>
          </Section>
        {/if}

      </Panel>
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

  :global(.modal-container) {
    overflow: hidden;
    box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.4));
  }

  .modal-footer {
    display: flex;
    gap: var(--space-3, 0.75rem);
    justify-content: flex-end;
  }
</style>