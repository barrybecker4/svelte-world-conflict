<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    subtitle?: string;
    padding?: string;
    borderBottom?: boolean;
    flex?: boolean;
    flexDirection?: string;
    gap?: string;
    customClass?: string;
    children?: Snippet;
    actions?: Snippet;
  }

  let {
    title = '',
    subtitle = '',
    padding = '16px',
    borderBottom = true,
    flex = false,
    flexDirection = 'column',
    gap = '8px',
    customClass = '',
    children,
    actions
  }: Props = $props();

  let classes = $derived([
    'section-base',
    borderBottom && 'section-border',
    flex && 'section-flex',
    customClass
  ].filter(Boolean).join(' '));

  let sectionStyle = $derived(`
    padding: ${padding};
    ${flex ? `display: flex; flex-direction: ${flexDirection}; gap: ${gap};` : ''}
  `);
</script>

<section class={classes} style={sectionStyle}>
  {#if title}
    <div class="section-header">
      <h3 class="section-title">{title}</h3>
      {#if subtitle}
        <p class="section-subtitle">{subtitle}</p>
      {/if}
    </div>
  {/if}

  <div class="section-content">
    {@render children?.()}
  </div>

  {#if actions}
    <div class="section-actions">
      {@render actions()}
    </div>
  {/if}
</section>

<style>
  .section-base {
    flex: 0 0 auto;
    background: transparent;
  }

  .section-border {
    border-bottom: 1px solid #4a5568;
  }

  .section-flex {
    display: flex;
  }

  .section-header {
    margin-bottom: 0.75rem;
  }

  .section-title {
    margin: 0 0 0.25rem 0;
    color: #f8fafc;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .section-subtitle {
    margin: 0;
    color: #94a3b8;
    font-size: 0.9rem;
  }

  .section-content {
    flex: 1;
  }

  .section-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  /* Common section variants */
  .section-base.turn-section .section-content {
    background: transparent;
    padding: 0;
    border-radius: 0;
    text-align: center;
  }

  .section-base.stats-section .section-content {
    display: flex;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 6px;
    border: 1px solid #4a5568;
    overflow: hidden;
  }
</style>
