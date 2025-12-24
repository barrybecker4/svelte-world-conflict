<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import Panel from './Panel.svelte';
  import Section from './Section.svelte';

  interface Props {
    isOpen?: boolean;
    title?: string;
    showHeader?: boolean;
    showCloseButton?: boolean;
    width?: string;
    height?: string;
    onclose?: () => void;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    isOpen = false,
    title = '',
    showHeader = true,
    showCloseButton = true,
    width = '500px',
    height = '90vh',
    onclose,
    children,
    footer
  }: Props = $props();

  function handleClose() {
    onclose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function handleBackdropClick() {
    handleClose();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClose();
    }
  }

  function stopPropagation(event: Event) {
    event.stopPropagation();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleBackdropKeydown}
    role="button"
    aria-label="Close modal"
    tabindex="0"
  >
    <div
      class="modal-wrapper"
      style="width: {width}; max-height: {height}"
      onclick={stopPropagation}
      onkeydown={stopPropagation}
      role="dialog"
      tabindex="-1"
      aria-labelledby={showHeader ? "modal-title" : undefined}
      aria-modal="true"
    >
      <Panel
        variant="dark"
        padding={false}
        customClass="modal-container"
      >

        {#if showHeader}
          <Section title={title} borderBottom={true}>
            {#snippet actions()}
              {#if showCloseButton}
                <IconButton variant="default" size="sm" title="Close" onclick={handleClose}>
                  ✕
                </IconButton>
              {/if}
            {/snippet}
          </Section>
        {/if}

        <Section title="" borderBottom={false}>
          {@render children?.()}
        </Section>

        {#if footer}
          <Section title="" borderBottom={false} customClass="modal-footer-section">
            <div class="modal-footer">
              {@render footer()}
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
    z-index: var(--z-modal, 2000);
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